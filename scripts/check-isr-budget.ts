/**
 * Guardrail del presupuesto de ISR.
 *
 * En agosto de 2026 el proyecto llegó a ~500k escrituras de ISR en un mes sin
 * tráfico humano: el padrón del JNE genera ~570 rutas prerenderizadas y todas
 * declaraban `revalidate = 1800`, así que cada crawler que recorría el sitemap
 * disparaba una escritura. Los datos, en cambio, solo cambian cuando corre el
 * cron.
 *
 * Este check corre en CI para que esa regresión no vuelva a entrar sin que
 * alguien lo decida a propósito. Verifica dos cosas sobre el código fuente, sin
 * necesitar build ni base de datos:
 *
 *   1. Ninguna página declara un `revalidate` por debajo del mínimo.
 *   2. Ningún Route Handler que lee `searchParams` declara `revalidate`, porque
 *      esa ruta ya es dinámica y el valor no hace nada.
 *
 * Si además encuentra un `.next/prerender-manifest.json` de un build previo,
 * valida las rutas reales y reporta el techo de escrituras del mes.
 *
 * Para saltear el mínimo en una ruta puntual, poné este comentario en la línea
 * de arriba del `revalidate`:
 *
 *   // isr-budget-ok: <razón>
 *
 * Queda en el diff, que es justamente la idea.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Un día. Las páginas se refrescan con revalidatePath desde el cron, no por TTL. */
const MIN_TTL_SEGUNDOS = 86_400;
/** Margen sobre las ~17k esperadas, para que avise antes de que se dispare. */
const MAX_ESCRITURAS_MES = 50_000;
const SEGUNDOS_POR_MES = 30 * 24 * 60 * 60;

const RAIZ = process.cwd();
const APP = join(RAIZ, "src", "app");

const REVALIDATE = /^[ \t]*export[ \t]+const[ \t]+revalidate[ \t]*=[ \t]*([0-9_]+)[ \t]*;/m;
const EXCEPCION = /\/\/[ \t]*isr-budget-ok:/;
const LEE_SEARCH_PARAMS = /searchParams|nextUrl/;

const problemas: string[] = [];

function archivosDeRuta(dir: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      encontrados.push(...archivosDeRuta(ruta));
    } else if (/^(page|route|sitemap)\.tsx?$/.test(entrada)) {
      encontrados.push(ruta);
    }
  }
  return encontrados;
}

for (const archivo of archivosDeRuta(APP)) {
  const nombre = relative(RAIZ, archivo);
  const fuente = readFileSync(archivo, "utf8");
  const match = REVALIDATE.exec(fuente);
  if (!match) continue;

  const ttl = Number(match[1].replace(/_/g, ""));
  const lineas = fuente.slice(0, match.index).split("\n");
  const anterior = lineas[lineas.length - 2] ?? "";
  const esRouteHandler = /\/route\.tsx?$/.test(nombre);

  if (esRouteHandler && LEE_SEARCH_PARAMS.test(fuente)) {
    problemas.push(
      `${nombre}: declara revalidate=${ttl} pero lee searchParams, así que la ruta ` +
        `ya es dinámica y ese valor no hace nada. Cacheá con Cache-Control en la respuesta.`
    );
    continue;
  }

  if (ttl < MIN_TTL_SEGUNDOS && !EXCEPCION.test(anterior)) {
    problemas.push(
      `${nombre}: revalidate=${ttl} está por debajo del mínimo de ${MIN_TTL_SEGUNDOS}. ` +
        `El TTL es la red de seguridad, no el mecanismo de actualización: refrescá con ` +
        `revalidarCandidatos() desde el cron. Si es deliberado, agregá "// isr-budget-ok: <razón>".`
    );
  }
}

// Si hay un build a mano, medimos las rutas reales en vez de estimar.
let resumenManifest = "sin build previo: no se midieron rutas reales";
try {
  const manifest = JSON.parse(
    readFileSync(join(RAIZ, ".next", "prerender-manifest.json"), "utf8")
  ) as { routes?: Record<string, { initialRevalidateSeconds?: number | false }> };

  const rutas = Object.entries(manifest.routes ?? {});
  let escrituras = 0;
  let conTtl = 0;

  for (const [, datos] of rutas) {
    const ttl = datos.initialRevalidateSeconds;
    if (typeof ttl !== "number" || ttl <= 0) continue;
    conTtl++;
    escrituras += SEGUNDOS_POR_MES / ttl;
  }

  const techo = Math.round(escrituras);
  resumenManifest =
    `${rutas.length} rutas prerenderizadas, ${conTtl} con TTL. ` +
    `Techo: ${techo.toLocaleString("es-PE")} escrituras/mes.`;

  if (techo > MAX_ESCRITURAS_MES) {
    problemas.push(
      `El techo de ${techo.toLocaleString("es-PE")} escrituras/mes supera el presupuesto ` +
        `de ${MAX_ESCRITURAS_MES.toLocaleString("es-PE")}.`
    );
  }
} catch {
  // Sin build no hay manifest; el chequeo del código fuente ya corrió.
}

console.log(`[isr-budget] ${resumenManifest}`);

if (problemas.length > 0) {
  console.error(`\n[isr-budget] ${problemas.length} problema(s):\n`);
  for (const problema of problemas) console.error(`  ✗ ${problema}\n`);
  process.exit(1);
}

console.log("[isr-budget] OK");
