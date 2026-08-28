import axios from "axios";
import * as cheerio from "cheerio";
import { prisma } from "./db";
import { CANDIDATOS, type CandidatoData } from "./candidatos";
import { CANDIDATOS_MUNICIPALES, DISTRITO_BY_SLUG } from "./municipales";
import type { EleccionId } from "./elecciones";
import { clasificarNoticia, esNoticiaRelevante } from "./clasificador";
import { clasificarConIA } from "./clasificador-ia";

// El scraping recorre todas las elecciones cubiertas.
type CandidatoScrape = CandidatoData & {
  eleccion: EleccionId;
  ambito: string | null;
  estado: string | null;
  hojaVidaId: number | null;
};

const PRESIDENCIALES: CandidatoScrape[] = CANDIDATOS.map((c) => ({
  ...c,
  eleccion: "presidencial-2026" as const,
  ambito: null,
  estado: null,
  hojaVidaId: null,
}));

const MUNICIPALES: CandidatoScrape[] = CANDIDATOS_MUNICIPALES.map((c) => ({
  ...c,
  eleccion: "municipal-2026" as const,
}));

/** Todos los candidatos: se upsertean en BD y se usan para atribuir noticias. */
const CANDIDATOS_TODOS: CandidatoScrape[] = [...PRESIDENCIALES, ...MUNICIPALES];
const CANDIDATOS_BY_SLUG = new Map(CANDIDATOS_TODOS.map((candidato) => [candidato.slug, candidato]));

// Las búsquedas por candidato (Google News + buscadores de medios) son la parte
// cara: con 485 municipales no entran en los 300s de la función. El cron regular
// se dedica a alcaldes y rota por ventana cada 12 horas. Presidenciales queda
// disponible solo para una corrida explícita de mantenimiento.
const MUNICIPALES_POR_RUN = Number(process.env.SCRAPE_MUNICIPALES_POR_RUN ?? 40);

function ventanaMunicipal(fecha = new Date()): CandidatoScrape[] {
  if (MUNICIPALES.length === 0 || MUNICIPALES_POR_RUN <= 0) return [];
  if (MUNICIPALES_POR_RUN >= MUNICIPALES.length) return MUNICIPALES;

  const franja = Math.floor(fecha.getTime() / 43_200_000);
  const totalVentanas = Math.ceil(MUNICIPALES.length / MUNICIPALES_POR_RUN);
  const inicio = (franja % totalVentanas) * MUNICIPALES_POR_RUN;
  return MUNICIPALES.slice(inicio, inicio + MUNICIPALES_POR_RUN);
}

export interface ScrapingOptions {
  eleccion?: EleccionId;
  ambito?: string;
  fecha?: Date;
  /** Backfill histórico: fecha inclusiva desde la que se buscarán noticias. */
  desde?: Date;
  /** Backfill histórico: límite superior exclusivo. */
  hasta?: Date;
}

/** Candidatos a buscar en esta corrida o en un backfill municipal acotado. */
function candidatosDeEstaCorrida(options: ScrapingOptions): CandidatoScrape[] {
  if (options.eleccion === "presidencial-2026") return PRESIDENCIALES;
  if (options.eleccion === "municipal-2026") {
    return options.ambito
      ? MUNICIPALES.filter((candidato) => candidato.ambito === options.ambito)
      : ventanaMunicipal(options.fecha);
  }
  return ventanaMunicipal(options.fecha);
}

interface NoticiaRaw {
  titulo: string;
  descripcion: string;
  url: string;
  fuente: string;
  fechaPublicacion: Date | null;
  /** Candidato que originó una búsqueda nominal; evita atribuciones por coincidencia. */
  candidatoSlug?: string;
}

function normalizarUrl(url: string): string {
  return url.split("?")[0].replace(/\/$/, "");
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept-Language": "es-PE,es;q=0.9,en;q=0.5",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// Excluir secciones deportivas, entretenimiento y videos
const EXCLUIR_PATTERNS = [
  "/deportes", "/deporte", "/futbol", "/liga-1", "/champions",
  "/seleccion", "/fichajes", "/olimpicos", "/espectaculos",
  "/entretenimiento", "/tv-shows", "/celebridades", "/horoscopo",
  "/tendencias", "/virales", "/tecnologia", "/ciencia",
  "/gastronomia", "/turismo", "/salud", "/bienestar",
  // Video — no podemos analizar contenido audiovisual
  "/video", "/videos", "/en-vivo", "/envivo", "/live",
  "/tv/", "/programa/", "/podcast", "/podcasts",
  "/multimedia", "/galeria", "/galerias", "/fotos",
];

// Patrones en URL que indican contenido de solo video
const VIDEO_URL_PATTERNS = [
  "/video/", "/videos/", "/en-vivo", "/envivo", "/live/",
  "/tv/", "/multimedia/", "/podcast/",
  "youtube.com", "youtu.be", "tiktok.com",
  "facebook.com/watch", "fb.watch",
  "/shorts/", "/reel/", "/reels/",
];

// Patrones en título que indican contenido de solo video
const VIDEO_TITULO_PATTERNS = [
  "[video]", "[en vivo]", "[envivo]", "[live]",
  "| video", "| en vivo",
  "mira el video", "mira aquí", "mira aqui",
  "ver video", "video completo", "video:", "vídeo:",
  "[podcast]", "| podcast",
  "transmisión en vivo", "transmision en vivo",
  "en vivo:", "en vivo |", "en directo",
  "#envivo", "#enlace", "#endirecto",
];

function esExcluida(url: string): boolean {
  const urlLower = url.toLowerCase();
  return EXCLUIR_PATTERNS.some((p) => urlLower.includes(p));
}

function esVideo(url: string, titulo: string, descripcion: string): boolean {
  const urlLower = url.toLowerCase();
  const tituloLower = titulo.toLowerCase();
  const descLower = descripcion.toLowerCase();

  // Verificar URL
  if (VIDEO_URL_PATTERNS.some((p) => urlLower.includes(p))) return true;

  // Verificar título
  if (VIDEO_TITULO_PATTERNS.some((p) => tituloLower.includes(p))) return true;

  // Descripción muy corta + mención de video = probablemente solo video
  if (descripcion.length < 50 && (descLower.includes("video") || descLower.includes("vídeo"))) return true;

  // Sin descripción y título corto = probablemente clip de video
  if (!descripcion && titulo.length < 60) return false; // no podemos saber, dejarlo pasar

  return false;
}

// Intentar extraer fecha de publicación del HTML de un artículo
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extraerFechaHTML($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): Date | null {
  // 1. Buscar <time datetime="">
  const timeEl = $el.find("time[datetime]").first();
  if (timeEl.length) {
    const dt = new Date(timeEl.attr("datetime") || "");
    if (!isNaN(dt.getTime())) return dt;
  }

  // 2. Buscar meta/span con clases típicas de fecha
  const fechaSelectores = [
    "[class*='date']", "[class*='fecha']", "[class*='time']",
    "[class*='publish']", "[class*='posted']", "[data-date]",
    "[itemprop='datePublished']", "[itemprop='dateCreated']",
  ];
  for (const sel of fechaSelectores) {
    const el = $el.find(sel).first();
    if (el.length) {
      const dateStr = el.attr("datetime") || el.attr("content") || el.attr("data-date") || el.text().trim();
      const dt = parseFechaFlexible(dateStr);
      if (dt) return dt;
    }
  }

  // 3. Intentar extraer fecha de la URL (formato /2026/03/10/ o /2026-03-10)
  const urlMatch = ($el.find("a[href]").first().attr("href") || "").match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (urlMatch) {
    const dt = new Date(`${urlMatch[1]}-${urlMatch[2]}-${urlMatch[3]}`);
    if (!isNaN(dt.getTime())) return dt;
  }
  const urlMatch2 = ($el.find("a[href]").first().attr("href") || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (urlMatch2) {
    const dt = new Date(`${urlMatch2[1]}-${urlMatch2[2]}-${urlMatch2[3]}`);
    if (!isNaN(dt.getTime())) return dt;
  }

  return null;
}

// Parsear fechas en formatos comunes en medios peruanos
function parseFechaFlexible(texto: string): Date | null {
  if (!texto || texto.length < 6) return null;

  // ISO 8601
  const isoDate = new Date(texto);
  if (!isNaN(isoDate.getTime()) && texto.match(/\d{4}/)) return isoDate;

  // "10 de marzo de 2026", "10 mar. 2026", "10/03/2026"
  const meses: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
    jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11,
  };

  const textoLower = texto.toLowerCase().replace(/\./g, "").trim();

  // "10 de marzo de 2026" / "10 marzo 2026"
  const match1 = textoLower.match(/(\d{1,2})\s+(?:de\s+)?(\w+)\s+(?:de\s+)?(\d{4})/);
  if (match1) {
    const mes = meses[match1[2]];
    if (mes !== undefined) {
      return new Date(parseInt(match1[3]), mes, parseInt(match1[1]));
    }
  }

  // "10/03/2026" o "10-03-2026" (formato dd/mm/yyyy peruano)
  const match2 = textoLower.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match2) {
    return new Date(parseInt(match2[3]), parseInt(match2[2]) - 1, parseInt(match2[1]));
  }

  return null;
}

// Helper para extraer noticias de HTML genérico (funciona para medios del grupo El Comercio / ECO)
function extraerNoticiasHTML(
  html: string,
  baseUrl: string,
  fuente: string,
  selectores?: { articulo?: string; titulo?: string; desc?: string; link?: string }
): NoticiaRaw[] {
  const noticias: NoticiaRaw[] = [];
  const $ = cheerio.load(html);

  const selArticulo = selectores?.articulo ||
    "article, [class*='story'], [class*='card'], [class*='article'], [class*='nota'], [class*='item'], [class*='entry'], [class*='post'], .news-item, li[class*='news']";
  const selTitulo = selectores?.titulo ||
    "h1, h2, h3, h4, .title, [class*='title'], [class*='headline'], .entry-title";
  const selDesc = selectores?.desc ||
    "p, .summary, .description, [class*='desc'], [class*='summary'], [class*='excerpt'], [class*='lead']";
  const selLink = selectores?.link || "a[href]";

  $(selArticulo).each((_, el) => {
    const $el = $(el);
    const titulo = $el.find(selTitulo).first().text().trim();
    const descripcion = $el.find(selDesc).first().text().trim();
    const linkEl = $el.find(selLink).first();
    let url = linkEl.attr("href") || "";

    // También intentar si el propio articulo es un <a>
    if (!url && $el.is("a")) url = $el.attr("href") || "";

    if (url && !url.startsWith("http")) {
      url = url.startsWith("/") ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
    }

    // Extraer fecha de publicación
    const fechaPublicacion = extraerFechaHTML($el, $);

    if (titulo && titulo.length > 15 && url && !esExcluida(url) && !esVideo(url, titulo, descripcion)) {
      noticias.push({ titulo, descripcion: descripcion.slice(0, 500), url, fuente, fechaPublicacion });
    }
  });

  // Fallback: buscar todos los <a> con texto largo (para sitios difíciles)
  if (noticias.length < 5) {
    $("a[href]").each((_, el) => {
      const $el = $(el);
      const texto = $el.text().trim();
      let url = $el.attr("href") || "";
      if (url && !url.startsWith("http")) {
        url = url.startsWith("/") ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
      }
      if (texto.length > 30 && url && !esExcluida(url) && !esVideo(url, texto, "") && url.includes(baseUrl)) {
        // Evitar duplicados
        if (!noticias.find((n) => n.url === url)) {
          // Intentar fecha de la URL
          const urlDateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
          let fechaPublicacion: Date | null = null;
          if (urlDateMatch) {
            fechaPublicacion = new Date(`${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`);
            if (isNaN(fechaPublicacion.getTime())) fechaPublicacion = null;
          }
          noticias.push({ titulo: texto, descripcion: "", url, fuente, fechaPublicacion });
        }
      }
    });
  }

  return noticias;
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 20000 });
    return data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const status = e.response?.status;
      // 403/404 son comunes por anti-bot o rutas rotas; evitar ruido en logs.
      if (status === 403 || status === 404) return null;
      console.error(`Error fetching ${url}: HTTP ${status ?? "?"} ${e.message}`);
      return null;
    }
    console.error(`Error fetching ${url}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// =====================================================
// SCRAPERS POR FUENTE — Secciones de política y búsqueda directa
// =====================================================

// --- Grupo El Comercio (ECO): elcomercio.pe, peru21.pe, gestion.pe, ojo.pe, correo.pe ---

async function scrapeElComercio(): Promise<NoticiaRaw[]> {
  const urls = [
    "https://elcomercio.pe/politica/",
    "https://elcomercio.pe/politica/actualidad/",
    "https://elcomercio.pe/politica/congreso/",
    "https://elcomercio.pe/politica/gobierno/",
    "https://elcomercio.pe/politica/poder-judicial/",
  ];
  const todas: NoticiaRaw[] = [];
  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) todas.push(...extraerNoticiasHTML(html, "https://elcomercio.pe", "El Comercio"));
  }
  return todas;
}

async function scrapePeru21(): Promise<NoticiaRaw[]> {
  const urls = [
    "https://peru21.pe/politica/",
    "https://peru21.pe/politica/actualidad/",
  ];
  const todas: NoticiaRaw[] = [];
  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) todas.push(...extraerNoticiasHTML(html, "https://peru21.pe", "Perú 21"));
  }
  return todas;
}

async function scrapeGestion(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://gestion.pe/politica/");
  return html ? extraerNoticiasHTML(html, "https://gestion.pe", "Gestión") : [];
}

async function scrapeOjo(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://ojo.pe/politica/");
  return html ? extraerNoticiasHTML(html, "https://ojo.pe", "Ojo") : [];
}

async function scrapeCorreo(): Promise<NoticiaRaw[]> {
  const urls = [
    "https://diariocorreo.pe/politica/",
    "https://diariocorreo.pe/politica/actualidad/",
  ];
  const todas: NoticiaRaw[] = [];
  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) todas.push(...extraerNoticiasHTML(html, "https://diariocorreo.pe", "Correo"));
  }
  return todas;
}

// --- RPP ---
async function scrapeRPP(): Promise<NoticiaRaw[]> {
  const urls = [
    "https://rpp.pe/politica",
    "https://rpp.pe/politica/elecciones",
    "https://rpp.pe/politica/gobierno",
    "https://rpp.pe/politica/congreso",
    "https://rpp.pe/politica/judiciales",
  ];
  const todas: NoticiaRaw[] = [];
  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) todas.push(...extraerNoticiasHTML(html, "https://rpp.pe", "RPP"));
  }
  return todas;
}

// --- La República ---
async function scrapeLaRepublica(): Promise<NoticiaRaw[]> {
  const urls = [
    "https://larepublica.pe/politica",
    "https://larepublica.pe/politica/gobierno",
    "https://larepublica.pe/politica/congreso",
    "https://larepublica.pe/politica/judiciales",
  ];
  const todas: NoticiaRaw[] = [];
  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) todas.push(...extraerNoticiasHTML(html, "https://larepublica.pe", "La República"));
  }
  return todas;
}

// --- Expreso ---
async function scrapeExpreso(): Promise<NoticiaRaw[]> {
  const urls = [
    "https://www.expreso.com.pe/politica/",
    "https://www.expreso.com.pe/opinion/",
  ];
  const todas: NoticiaRaw[] = [];
  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) todas.push(...extraerNoticiasHTML(html, "https://www.expreso.com.pe", "Expreso"));
  }
  return todas;
}

// --- Infobae Perú ---
async function scrapeInfobae(): Promise<NoticiaRaw[]> {
  const urls = [
    "https://www.infobae.com/peru/",
    "https://www.infobae.com/peru/politica/",
  ];
  const todas: NoticiaRaw[] = [];
  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) todas.push(...extraerNoticiasHTML(html, "https://www.infobae.com", "Infobae Perú"));
  }
  return todas;
}

// --- Exitosa ---
async function scrapeExitosa(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://exitosanoticias.pe/politica/");
  return html ? extraerNoticiasHTML(html, "https://exitosanoticias.pe", "Exitosa") : [];
}

// --- Canal N ---
async function scrapeCanalN(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://canaln.pe/politica");
  return html ? extraerNoticiasHTML(html, "https://canaln.pe", "Canal N") : [];
}

// --- Panamericana ---
async function scrapePanamericana(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://panamericana.pe/politica");
  return html ? extraerNoticiasHTML(html, "https://panamericana.pe", "Panamericana") : [];
}

// --- Andina (agencia estatal) ---
async function scrapeAndina(): Promise<NoticiaRaw[]> {
  const urls = [
    "https://andina.pe/agencia/seccion-politica-1.aspx",
    "https://andina.pe/agencia/seccion-poder-judicial-42.aspx",
  ];
  const todas: NoticiaRaw[] = [];
  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) todas.push(...extraerNoticiasHTML(html, "https://andina.pe", "Andina"));
  }
  return todas;
}

// --- IDL Reporteros (periodismo de investigación) ---
async function scrapeIDLReporteros(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://www.idl-reporteros.pe/");
  return html ? extraerNoticiasHTML(html, "https://www.idl-reporteros.pe", "IDL-Reporteros") : [];
}

// --- Ojo Público (periodismo de investigación) ---
async function scrapeOjoPublico(): Promise<NoticiaRaw[]> {
  const urls = [
    "https://ojo-publico.com/",
    "https://ojo-publico.com/poder",
  ];
  const todas: NoticiaRaw[] = [];
  for (const url of urls) {
    const html = await fetchPage(url);
    if (html) todas.push(...extraerNoticiasHTML(html, "https://ojo-publico.com", "Ojo Público"));
  }
  return todas;
}

// --- Convoca (periodismo de investigación) ---
async function scrapeConvoca(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://convoca.pe/");
  return html ? extraerNoticiasHTML(html, "https://convoca.pe", "Convoca") : [];
}

// --- Wayka ---
async function scrapeWayka(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://wayka.pe/");
  return html ? extraerNoticiasHTML(html, "https://wayka.pe", "Wayka") : [];
}

// --- El Búho ---
async function scrapeElBuho(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://elbuho.pe/politica/");
  return html ? extraerNoticiasHTML(html, "https://elbuho.pe", "El Búho") : [];
}

// --- Latina Noticias ---
async function scrapeLatina(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://www.latina.pe/politica");
  return html ? extraerNoticiasHTML(html, "https://www.latina.pe", "Latina") : [];
}

// --- Líbero (solo sección política si existe) ---
async function scrapeLibero(): Promise<NoticiaRaw[]> {
  const html = await fetchPage("https://libero.pe/politica/");
  if (!html) return [];
  // Líbero es más deportivo, pero a veces tiene política
  return extraerNoticiasHTML(html, "https://libero.pe", "Líbero");
}

// =====================================================
// GOOGLE NEWS RSS — Búsqueda ampliada por candidato y partido
// =====================================================

const SITES_PERU = [
  "site:rpp.pe", "site:elcomercio.pe", "site:larepublica.pe",
  "site:gestion.pe", "site:peru21.pe", "site:diariocorreo.pe",
  "site:ojo.pe", "site:infobae.com/peru", "site:exitosanoticias.pe",
  "site:canaln.pe", "site:andina.pe", "site:idl-reporteros.pe",
  "site:ojo-publico.com", "site:convoca.pe", "site:wayka.pe",
  "site:panamericana.pe", "site:elbuho.pe", "site:expreso.com.pe",
  "site:latina.pe",
].join(" OR ");

async function scrapeGoogleNewsRSS(
  query: string,
  intento = 1,
  estricto = false
): Promise<NoticiaRaw[]> {
  const noticias: NoticiaRaw[] = [];
  try {
    const encodedQuery = encodeURIComponent(query);
    const { data } = await axios.get(
      `https://news.google.com/rss/search?q=${encodedQuery}&hl=es-419&gl=PE&ceid=PE:es-419`,
      { headers: HEADERS, timeout: 20000 }
    );
    const $ = cheerio.load(data, { xmlMode: true });

    $("item").each((_, el) => {
      const $el = $(el);
      const titulo = $el.find("title").text().trim();
      const url = $el.find("link").text().trim() ||
        $el.find("link").next().text().trim();
      const descripcion = $el.find("description").text().trim().replace(/<[^>]*>/g, "");
      const fuente = $el.find("source").text().trim() || "Google News";

      // Extraer fecha de publicación del RSS
      const pubDateStr = $el.find("pubDate").text().trim();
      let fechaPublicacion: Date | null = null;
      if (pubDateStr) {
        const dt = new Date(pubDateStr);
        if (!isNaN(dt.getTime())) fechaPublicacion = dt;
      }

      if (titulo && url && !esExcluida(url) && !esVideo(url, titulo, descripcion)) {
        noticias.push({ titulo, descripcion: descripcion.slice(0, 500), url, fuente, fechaPublicacion });
      }
    });
  } catch (e) {
    const status = axios.isAxiosError(e) ? e.response?.status : undefined;
    if (intento < 3 && (!status || status === 429 || status >= 500)) {
      await delay(5_000 * 2 ** (intento - 1));
      return scrapeGoogleNewsRSS(query, intento + 1, estricto);
    }
    if (estricto) throw e;
    console.error(`Error Google News RSS [${query.slice(0, 50)}]:`, e instanceof Error ? e.message : e);
  }
  return noticias;
}

function nombreAmbito(candidato: CandidatoScrape): string {
  if (candidato.ambito === "lima-metropolitana") return "Lima Metropolitana";
  return candidato.ambito
    ? DISTRITO_BY_SLUG.get(candidato.ambito)?.nombre ?? candidato.ambito.replaceAll("-", " ")
    : "Perú";
}

interface RangoBusqueda {
  desde: Date;
  hasta: Date;
}

function fechaBusqueda(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

// Búsquedas múltiples por candidato en Google News
async function buscarCandidatoGoogleNews(
  candidato: CandidatoScrape,
  rangoHistorico?: RangoBusqueda
): Promise<NoticiaRaw[]> {
  const todas: NoticiaRaw[] = [];
  const termsLegales = "denuncia OR acusación OR sentencia OR investigación OR proceso OR fiscalía OR condena OR prisión";
  let consultas: string[] = [];

  if (candidato.eleccion === "municipal-2026") {
    const ambito = nombreAmbito(candidato);
    consultas = rangoHistorico
      ? [
          `"${candidato.nombre}" (alcalde OR municipalidad OR candidatura OR elecciones OR ${termsLegales}) "${ambito}"`,
          `"${candidato.keywords[0]}" (alcalde OR municipalidad OR política OR ${termsLegales}) ("${ambito}" OR Lima)`,
        ]
      : [
          `"${candidato.nombre}" (${termsLegales}) (alcalde OR municipalidad OR "${ambito}") (${SITES_PERU})`,
          `"${candidato.nombre}" (alcalde OR candidatura OR "elecciones municipales") "${ambito}" (${SITES_PERU})`,
          ...(candidato.keywords[0] && candidato.keywords[0] !== candidato.nombre
            ? [`"${candidato.keywords[0]}" (alcalde OR municipalidad OR "${ambito}") (${termsLegales})`]
            : []),
        ];
  } else {
    consultas = [
      `"${candidato.keywords[0]}" (${termsLegales}) (${SITES_PERU})`,
      `"${candidato.keywords[0]}" (elecciones OR candidato OR partido OR campaña) (${SITES_PERU})`,
    ];
    if (candidato.partido.length > 5) {
      consultas.push(
        `"${candidato.partido}" (denuncia OR acusación OR investigación OR escándalo OR sentencia) (${SITES_PERU})`
      );
    }
    if (candidato.keywords.length > 1 && candidato.keywords[1] !== candidato.keywords[0]) {
      consultas.push(
        `"${candidato.keywords[1]}" Perú (denuncia OR acusación OR sentencia OR investigación)`
      );
    }
  }

  const sufijoFecha = rangoHistorico
    ? ` after:${fechaBusqueda(rangoHistorico.desde)} before:${fechaBusqueda(rangoHistorico.hasta)}`
    : "";
  for (const consulta of consultas) {
    todas.push(...await scrapeGoogleNewsRSS(
      `${consulta}${sufijoFecha}`,
      1,
      Boolean(rangoHistorico)
    ));
  }

  return todas.map((noticia) => ({ ...noticia, candidatoSlug: candidato.slug }));
}

// =====================================================
// TWITTER/X — Periodistas y cuentas de investigación
// =====================================================

const TWITTER_ACCOUNTS = [
  { handle: "RogerAderly", nombre: "Roger Aderly", tipo: "Periodista" },
  { handle: "rlopezaliaga1", nombre: "Rafael López Aliaga", tipo: "Candidato" },
  // Periodistas y medios de investigación peruanos
  { handle: "GustavoGorriti", nombre: "Gustavo Gorriti", tipo: "IDL-Reporteros" },
  { handle: "RosaMariaPC", nombre: "Rosa María Palacios", tipo: "Periodista" },
  { handle: "Abordonao", nombre: "Augusto Álvarez Rodrich", tipo: "Periodista" },
  { handle: "PatydelR", nombre: "Patricia del Río", tipo: "Periodista" },
  { handle: "epicentro_tv", nombre: "Epicentro TV", tipo: "Medio" },
  { handle: "idaboronara", nombre: "Ida Abad Boronara", tipo: "Periodista" },
  { handle: "JNaborena", nombre: "José Naborena", tipo: "Periodista" },
  { handle: "OjoPublico", nombre: "Ojo Público", tipo: "Medio" },
  { handle: "Aboronare", nombre: "Aboronare", tipo: "Periodista" },
  { handle: "ConvocaPe", nombre: "Convoca", tipo: "Medio" },
];

async function scrapeTwitterAccounts(): Promise<NoticiaRaw[]> {
  const todas: NoticiaRaw[] = [];

  // Buscar tweets de cuentas clave sobre temas de candidatos/política/denuncias
  for (const account of TWITTER_ACCOUNTS) {
    // Buscar en Google News los tweets de esta cuenta que mencionan temas relevantes
    const queries = [
      `from:${account.handle} (denuncia OR acusación OR sentencia OR investigación OR corrupción OR candidato)`,
      `"${account.handle}" (denuncia OR escándalo OR acusación OR fiscal) site:x.com OR site:twitter.com`,
    ];

    for (const q of queries) {
      try {
        const noticias = await scrapeGoogleNewsRSS(q);
        // Marcar la fuente como Twitter + nombre
        for (const n of noticias) {
          n.fuente = `X/@${account.handle}`;
        }
        todas.push(...noticias);
      } catch {
        // Silently continue if a query fails
      }
    }

    await delay(500); // No saturar Google
  }

  return todas;
}

// =====================================================
// BÚSQUEDA DIRECTA en sitios — buscar por nombre del candidato en el buscador del medio
// =====================================================

async function buscarEnSitio(baseUrl: string, searchPath: string, keyword: string, fuente: string): Promise<NoticiaRaw[]> {
  const url = `${baseUrl}${searchPath}${encodeURIComponent(keyword)}`;
  const html = await fetchPage(url);
  if (!html) return [];
  return extraerNoticiasHTML(html, baseUrl, fuente);
}

async function buscarCandidatoEnSitios(keyword: string): Promise<NoticiaRaw[]> {
  const todas: NoticiaRaw[] = [];

  // Buscar en los buscadores internos de cada medio
  const sitios = [
    { base: "https://elcomercio.pe", path: "/buscar/?query=", fuente: "El Comercio" },
    { base: "https://larepublica.pe", path: "/buscar/?query=", fuente: "La República" },
    { base: "https://rpp.pe", path: "/buscar?q=", fuente: "RPP" },
    { base: "https://peru21.pe", path: "/buscar/?query=", fuente: "Perú 21" },
    { base: "https://gestion.pe", path: "/buscar/?query=", fuente: "Gestión" },
    { base: "https://diariocorreo.pe", path: "/buscar/?query=", fuente: "Correo" },
    { base: "https://www.infobae.com", path: "/peru/?query=", fuente: "Infobae Perú" },
  ];

  const results = await Promise.allSettled(
    sitios.map((s) => buscarEnSitio(s.base, s.path, keyword, s.fuente))
  );

  for (const r of results) {
    if (r.status === "fulfilled") todas.push(...r.value);
  }

  return todas;
}

// =====================================================
// LÓGICA PRINCIPAL
// =====================================================

function matchCandidato(texto: string, keywords: string[]): boolean {
  const textoLower = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return keywords.some((kw) => {
    const kwLower = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return textoLower.includes(kwLower);
  });
}

/**
 * Google puede devolver "Rosselli Amuruz" aunque el padrón tenga
 * "Yessica Rosselli Amuruz Dulanto". Para una búsqueda ya ligada a un
 * candidato aceptamos dos componentes distintivos del nombre; un solo apellido
 * no basta y evita atribuir homónimos o resultados genéricos del distrito.
 */
function matchCandidatoSugerido(texto: string, candidato: CandidatoScrape): boolean {
  if (matchCandidato(texto, candidato.keywords)) return true;
  const normalizado = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const ignorar = new Set(["de", "del", "la", "las", "los", "y"]);
  const tokens = [...new Set(
    candidato.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4 && !ignorar.has(token))
  )];
  return tokens.filter((token) => normalizado.includes(token)).length >= 2;
}

// Deduplicar por URL
function deduplicar(noticias: NoticiaRaw[]): NoticiaRaw[] {
  const porUrl = new Map<string, NoticiaRaw>();
  for (const noticia of noticias) {
    const normalizada = { ...noticia, url: normalizarUrl(noticia.url) };
    const anterior = porUrl.get(normalizada.url);
    if (!anterior || (!anterior.candidatoSlug && normalizada.candidatoSlug)) {
      porUrl.set(normalizada.url, normalizada);
    }
  }
  return [...porUrl.values()];
}

async function obtenerUrlsExistentes(urls: string[]): Promise<Set<string>> {
  const existentes = new Set<string>();
  const CHUNK_SIZE = 1000;

  for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
    const chunk = urls.slice(i, i + CHUNK_SIZE);
    const rows = await prisma.noticia.findMany({
      where: { url: { in: chunk } },
      select: { url: true },
    });

    for (const row of rows) existentes.add(row.url);
  }

  return existentes;
}

function seleccionarCandidato(
  texto: string,
  candidatos: CandidatoScrape[]
): CandidatoScrape | null {
  for (const candidato of candidatos) {
    if (matchCandidato(texto, candidato.keywords)) return candidato;
  }
  return null;
}

// Delay para no saturar servidores
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ejecutarScraping(
  options: ScrapingOptions = {}
): Promise<{ total: number; nuevas: number; errores: string[]; actualizados: string[] }> {
  const startedAt = Date.now();
  const errores: string[] = [];
  let nuevasGuardadas = 0; // filas realmente creadas
  // Slugs con noticias nuevas: el cron los usa para invalidar solo esas rutas.
  const actualizados = new Set<string>();

  const historico = options.desde && options.hasta
    ? { desde: options.desde, hasta: options.hasta }
    : null;
  if ((options.desde && !options.hasta) || (!options.desde && options.hasta)) {
    throw new Error("El backfill histórico requiere fechas desde y hasta.");
  }
  if (historico && historico.desde >= historico.hasta) {
    throw new Error("La fecha desde debe ser anterior a la fecha hasta.");
  }

  console.log(historico
    ? `[SCRAPER] Iniciando backfill histórico ${fechaBusqueda(historico.desde)} → ${fechaBusqueda(historico.hasta)}...`
    : "[SCRAPER] Iniciando monitoreo electoral...");

  // Búsqueda por candidato según la elección solicitada; sin opciones, alcaldes.
  const candidatosBusqueda = candidatosDeEstaCorrida(options);

  // Solo sincronizar la ventana actual. En un backfill por alcaldía evita repetir
  // 485 upserts en cada una de las 43 ejecuciones.
  for (const c of candidatosBusqueda) {
    const datos = {
      nombre: c.nombre,
      partido: c.partido,
      eleccion: c.eleccion,
      ambito: c.ambito,
      estado: c.estado,
      hojaVidaId: c.hojaVidaId,
    };
    await prisma.candidato.upsert({
      where: { slug: c.slug },
      update: datos,
      create: { ...datos, slug: c.slug },
    });
  }

  const presidencialesBusqueda = candidatosBusqueda.filter((c) => c.eleccion === "presidencial-2026").length;
  const municipalesBusqueda = candidatosBusqueda.length - presidencialesBusqueda;
  console.log(
    `[SCRAPER] Búsqueda por candidato: ${candidatosBusqueda.length} ` +
      `(${presidencialesBusqueda} presidenciales + ${municipalesBusqueda} municipales de ${MUNICIPALES.length})`
  );

  let todasLasNoticias: NoticiaRaw[] = [];

  if (!historico) {
    // ---- FASE 1: Scraping de secciones de política de todos los medios ----
    console.log("[SCRAPER] Fase 1: Scraping de secciones de política...");
    const scrapersDirectos = await Promise.allSettled([
      scrapeRPP(), scrapeElComercio(), scrapeLaRepublica(), scrapeGestion(),
      scrapePeru21(), scrapeOjo(), scrapeCorreo(), scrapeExpreso(), scrapeInfobae(),
      scrapeExitosa(), scrapeCanalN(), scrapePanamericana(), scrapeAndina(),
      scrapeIDLReporteros(), scrapeOjoPublico(), scrapeConvoca(), scrapeWayka(),
      scrapeElBuho(), scrapeLatina(), scrapeLibero(),
    ]);
    for (const result of scrapersDirectos) {
      if (result.status === "fulfilled") todasLasNoticias.push(...result.value);
      else errores.push(result.reason?.message || "Error desconocido en scraper directo");
    }
    console.log(`[SCRAPER] Fase 1 completada: ${todasLasNoticias.length} noticias de secciones`);
  }

  // ---- FASE 2: Google News RSS por cada candidato ----
  console.log("[SCRAPER] Fase 2: Búsqueda por Google News RSS...");

  // Procesar en lotes de 4 candidatos para no saturar Google
  const BATCH_SIZE = historico ? 2 : 4;
  const rangos: Array<RangoBusqueda | undefined> = historico ? [historico] : [undefined];
  for (const rango of rangos) {
    if (rango) console.log(`[SCRAPER] Ventana ${fechaBusqueda(rango.desde)} → ${fechaBusqueda(rango.hasta)}`);
    for (let i = 0; i < candidatosBusqueda.length; i += BATCH_SIZE) {
      const batch = candidatosBusqueda.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((c) => buscarCandidatoGoogleNews(c, rango))
      );
      for (const r of results) {
        if (r.status === "fulfilled") todasLasNoticias.push(...r.value);
        else errores.push(`Google News batch: ${r.reason?.message || "error"}`);
      }
      if (historico && results.some((result) => result.status === "rejected")) {
        throw new Error(
          `Google News limitó el backfill en ${options.ambito ?? "ROTATIVO"}; reintentar más tarde.`
        );
      }
      if (i + BATCH_SIZE < candidatosBusqueda.length) await delay(1500);
    }
  }

  console.log(`[SCRAPER] Fase 2 completada: ${todasLasNoticias.length} noticias total con Google News`);

  // ---- FASE 3: Búsqueda directa en buscadores internos de medios ----
  if (!historico) {
    console.log("[SCRAPER] Fase 3: Búsqueda directa en buscadores de medios...");
    for (let i = 0; i < candidatosBusqueda.length; i += BATCH_SIZE) {
      const batch = candidatosBusqueda.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((c) => buscarCandidatoEnSitios(c.keywords[0]))
      );
      for (let resultIndex = 0; resultIndex < results.length; resultIndex++) {
        const result = results[resultIndex];
        if (result.status === "fulfilled") {
          todasLasNoticias.push(...result.value.map((noticia) => ({
            ...noticia,
            candidatoSlug: batch[resultIndex].slug,
          })));
        } else errores.push(`Búsqueda directa: ${result.reason?.message || "error"}`);
      }
      if (i + BATCH_SIZE < candidatosBusqueda.length) await delay(1000);
    }
    console.log(`[SCRAPER] Fase 3 completada: ${todasLasNoticias.length} noticias total`);

    // ---- FASE 4: Twitter/X — Periodistas y cuentas de investigación ----
    console.log("[SCRAPER] Fase 4: Buscando reportes de Twitter/X...");
    try {
      const twitterNoticias = await scrapeTwitterAccounts();
      todasLasNoticias.push(...twitterNoticias);
      console.log(`[SCRAPER] Fase 4 completada: ${twitterNoticias.length} noticias de Twitter/X`);
    } catch (e) {
      errores.push(`Twitter scraping: ${e instanceof Error ? e.message : "error"}`);
      console.error("[SCRAPER] Error en fase Twitter:", e);
    }
  }

  if (historico) {
    todasLasNoticias = todasLasNoticias.filter((noticia) =>
      noticia.fechaPublicacion
      && noticia.fechaPublicacion >= historico.desde
      && noticia.fechaPublicacion < historico.hasta
    );
  }

  // Deduplicar
  todasLasNoticias = deduplicar(todasLasNoticias);
  console.log(`[SCRAPER] Después de deduplicar: ${todasLasNoticias.length} noticias únicas`);

  const totalEncontradas = todasLasNoticias.length;

  // Filtrar solo URLs no existentes para no reclasificar/reprocesar histórico
  const urlsUnicas = todasLasNoticias.map((n) => n.url);
  const urlsExistentes = await obtenerUrlsExistentes(urlsUnicas);
  const noticiasNuevas = todasLasNoticias.filter((n) => !urlsExistentes.has(n.url));
  const urlsOmitidas = totalEncontradas - noticiasNuevas.length;
  console.log(
    `[SCRAPER] URLs nuevas a procesar: ${noticiasNuevas.length} (existentes omitidas: ${urlsOmitidas})`
  );

  // Obtener todos los candidatos de la BD
  const candidatosBD = await prisma.candidato.findMany();
  const candidatosBySlug = new Map(candidatosBD.map((c) => [c.slug, c]));

  // ---- FASE 5: Match + Clasificar (IA + fallback patrones) + Guardar ----
  const useIA = !!process.env.OPENAI_API_KEY;
  console.log(`[SCRAPER] Fase 5: Clasificando y guardando... (IA: ${useIA ? "SÍ" : "NO — solo patrones"})`);

  let iaExitos = 0;
  let iaFallbacks = 0;

  for (const noticia of noticiasNuevas) {
    const textoCompleto = `${noticia.titulo} ${noticia.descripcion}`;
    const sugerido = noticia.candidatoSlug ? CANDIDATOS_BY_SLUG.get(noticia.candidatoSlug) : null;
    const candidato = sugerido && matchCandidatoSugerido(textoCompleto, sugerido)
      ? sugerido
      : seleccionarCandidato(textoCompleto, candidatosBusqueda);
    if (!candidato) continue;

    const candidatoBD = candidatosBySlug.get(candidato.slug);
    if (!candidatoBD) continue;

    // Guardar si es relevante (legal, político o electoral)
    if (!esNoticiaRelevante(noticia.titulo, noticia.descripcion)) continue;

    // Clasificación: intentar IA primero, fallback a patrones
    let gravedad: string;
    let tipo: string;

    if (useIA) {
      const iaResult = await clasificarConIA(noticia.titulo, noticia.descripcion, candidato.nombre);
      if (iaResult && iaResult.confianza >= 0.6) {
        gravedad = iaResult.gravedad;
        tipo = iaResult.tipo;
        iaExitos++;
      } else {
        // Fallback a patrones
        const clasificacion = clasificarNoticia(noticia.titulo, noticia.descripcion);
        gravedad = clasificacion.gravedad;
        tipo = clasificacion.tipo;
        iaFallbacks++;
      }
    } else {
      const clasificacion = clasificarNoticia(noticia.titulo, noticia.descripcion);
      gravedad = clasificacion.gravedad;
      tipo = clasificacion.tipo;
    }

    try {
      await prisma.noticia.create({
        data: {
          titulo: noticia.titulo,
          descripcion: noticia.descripcion || "Sin descripción disponible",
          url: noticia.url,
          fuente: noticia.fuente,
          gravedad,
          tipo,
          candidatoId: candidatoBD.id,
          fechaNoticia: noticia.fechaPublicacion,
        },
      });
      nuevasGuardadas++;
      actualizados.add(candidato.slug);
    } catch (e) {
      // Si otra ejecución insertó la URL en paralelo, ignorar el conflicto único.
      if (e instanceof Error && !e.message.includes("Unique constraint")) {
        errores.push(`DB: ${e.message}`);
      }
    }
  }

  if (useIA) {
    console.log(`[SCRAPER] Clasificación IA: ${iaExitos} exitosas, ${iaFallbacks} fallback a patrones`);
  }

  const duracionMs = Date.now() - startedAt;
  console.log(`[SCRAPER] Completado. ${totalEncontradas} encontradas, ${nuevasGuardadas} guardadas, ${errores.length} errores`);

  // Log del scraping
  await prisma.scrapingLog.create({
    data: {
      fuente: historico
        ? `MUNICIPAL_HISTORICO:${options.ambito ?? "ROTATIVO"}`
        : options.eleccion === "presidencial-2026"
        ? "PRESIDENCIAL"
        : `MUNICIPAL:${options.ambito ?? "ROTATIVO"}`,
      status: errores.length > 0 ? "PARCIAL" : "OK",
      mensaje: errores.length > 0 ? errores.slice(0, 10).join("; ") : null,
      noticias: nuevasGuardadas,
      totalScrapeadas: totalEncontradas,
      urlsNuevas: noticiasNuevas.length,
      urlsOmitidas,
      duracionMs,
    },
  });

  return {
    total: totalEncontradas,
    nuevas: nuevasGuardadas,
    errores: errores.slice(0, 20),
    actualizados: [...actualizados],
  };
}
