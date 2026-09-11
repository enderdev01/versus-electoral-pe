import Link from "next/link";
import { prisma } from "@/lib/db";
import { FaqAccordion } from "@/components/FaqAccordion";
import { MunicipalEntry } from "@/components/MunicipalEntry";
import { CANDIDATOS_MUNICIPALES, distritosConCandidatos, obtenerOpcionesMunicipales } from "@/lib/municipales";
import { METADATA_PLANES } from "@/lib/planes-gobierno";

// El cron invalida estas rutas con revalidatePath cuando el scraping trae algo
// nuevo. Este TTL es solo la red de seguridad por si esa invalidación no corre.
export const revalidate = 86400;

const HOME_STATS_BASE = {
  candidatos: CANDIDATOS_MUNICIPALES.length,
  alcaldias: distritosConCandidatos().length + 1,
  propuestas: METADATA_PLANES.propuestasGuardadas,
  fuentes: 20,
};

async function obtenerConteoNoticiasHome(): Promise<number> {
  try {
    return await prisma.noticia.count({
      where: { candidato: { eleccion: "municipal-2026" } },
    });
  } catch (error) {
    console.error("[HOME] Error contando noticias en DB, usando fallback estático:", error);
    return Number(process.env.NEXT_PUBLIC_HOME_MUNICIPAL_NEWS_COUNT || "0");
  }
}

export default async function Home() {
  const stats = {
    ...HOME_STATS_BASE,
    noticias: await obtenerConteoNoticiasHome(),
  };

  const faqData = [
    {
      question: "¿De dónde se obtiene la información de los candidatos?",
      answer:
        "Las candidaturas y planes de gobierno proceden de la Plataforma Electoral del JNE. Las noticias se recopilan de más de 20 medios periodísticos peruanos y cada registro conserva el enlace a su fuente original.",
    },
    {
      question: "¿Cómo se clasifica la gravedad de las noticias?",
      answer:
        "Se usa un sistema de clasificación contextual que analiza la dirección de la acción: si el candidato fue sentenciado, acusado o investigado (se clasifica por gravedad) o si el candidato propone, opina o critica (se descarta). Esto evita falsos positivos como clasificar una propuesta de ley como una sentencia.",
    },
    {
      question: "¿Con qué frecuencia se actualiza la información?",
      answer:
        "El monitoreo se ejecuta dos veces al día y rota por las alcaldías de Lima para mantener cubiertos los 485 candidatos sin saturar las fuentes.",
    },
    {
      question: "¿Esta clasificación tiene valor legal?",
      answer:
        "No. Las clasificaciones son automáticas y orientativas. No constituyen juicio legal ni reemplazan la presunción de inocencia. Consulte las fuentes originales para información completa.",
    },
  ];

  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />

      {/* Hero */}
      <section className="relative py-12 sm:py-16 lg:py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 via-gray-950/50 to-gray-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.08),transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl">
          <p className="text-red-500 text-[11px] font-bold uppercase tracking-[0.35em] mb-3 animate-fade-in">
            Elecciones Municipales · Lima 2026
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight leading-[1.05]">
            <span className="text-white">Versus</span>
            <br />
            <span className="text-red-500">Electoral Perú</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base lg:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Compara <strong className="text-white">{stats.candidatos} candidatos</strong> a las alcaldías de Lima,
            sus propuestas oficiales y noticias verificadas de {stats.fuentes} medios.
          </p>

          {/* Stats */}
          <div className="mt-6 sm:mt-8 inline-grid grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-gray-800/60 bg-gray-900/40 px-6 py-4 backdrop-blur-sm sm:grid-cols-4 sm:gap-8 sm:px-8">
            <div>
              <p className="text-2xl sm:text-3xl font-black text-white">{stats.candidatos}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mt-0.5">Candidatos</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-white">{stats.alcaldias}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mt-0.5">Alcaldías</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-white">{stats.propuestas.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mt-0.5">Propuestas</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-white">{stats.noticias.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wider mt-0.5">Noticias</p>
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-4xl text-left">
            <MunicipalEntry options={obtenerOpcionesMunicipales()} />
          </div>

          {/* CTA Cards */}
          <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            <Link prefetch={false}
              href="/alcaldes/versus"
              className="group relative overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/30 to-gray-900/80 p-6 sm:p-8 text-center transition-all duration-300 hover:border-red-500/60 hover:scale-[1.02] hover:shadow-[0_0_60px_rgba(220,38,38,0.15)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="text-4xl mb-3 flex justify-center">{/* Static inline SVG icon: next/image adds no value and the optimizer skips SVG. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/ic_versus.svg" alt="" className="w-9 h-9" style={{ filter: "brightness(0) invert(1)" }} /></div>
                <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">Versus</h2>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                  Compara candidatos de la misma alcaldía, sus propuestas y noticias
                </p>
                <div className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-600/20 text-red-400 text-xs font-bold uppercase tracking-wider group-hover:bg-red-600/30 transition-colors">
                  Comparar ahora
                  <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            </Link>

            <Link prefetch={false}
              href="/alcaldes"
              className="group relative overflow-hidden rounded-2xl border border-gray-700/50 bg-gradient-to-br from-gray-800/30 to-gray-900/80 p-6 sm:p-8 text-center transition-all duration-300 hover:border-gray-500/60 hover:scale-[1.02] hover:shadow-[0_0_60px_rgba(156,163,175,0.08)]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="text-4xl mb-3 flex justify-center">{/* Static inline SVG icon: next/image adds no value and the optimizer skips SVG. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/ic_candidate.svg" alt="" className="w-9 h-9" style={{ filter: "brightness(0) invert(1)" }} /></div>
                <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-wider">Candidatos</h2>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                  Explora Lima Metropolitana y sus 42 alcaldías distritales
                </p>
                <div className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gray-600/20 text-gray-300 text-xs font-bold uppercase tracking-wider group-hover:bg-gray-600/30 transition-colors">
                  Ver candidatos
                  <svg className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 border-t border-gray-800/40">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-black mb-10 text-center uppercase tracking-[0.2em] text-white">
            Preguntas Frecuentes
          </h2>
          <FaqAccordion items={faqData} />
        </div>
      </section>
    </div>
  );
}
