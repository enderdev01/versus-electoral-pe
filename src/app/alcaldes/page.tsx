import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { CandidatosList } from "@/components/CandidatosList";
import { obtenerResumenMunicipal } from "@/lib/candidatos-resumen";
import { getEleccion } from "@/lib/elecciones";
import {
  AMBITO_PROVINCIAL,
  DISTRITOS_LIMA,
  POSTULANTES_POR_AMBITO,
  distritosConCandidatos,
} from "@/lib/municipales";
import { SinDatosEleccion } from "@/components/SinDatosEleccion";

// El cron invalida estas rutas con revalidatePath cuando el scraping trae algo
// nuevo. Este TTL es solo la red de seguridad por si esa invalidación no corre.
export const revalidate = 86400;

const ELECCION = getEleccion("municipal-2026");

export const metadata: Metadata = {
  title: "Candidatos a Alcalde de Lima 2026",
  description:
    "Candidatos a la alcaldía de Lima Metropolitana y a las 42 alcaldías distritales en las elecciones municipales 2026, con sus propuestas y noticias.",
  alternates: {
    canonical: `${SITE_URL}/alcaldes`,
    languages: {
      "x-default": `${SITE_URL}/alcaldes`,
      es: `${SITE_URL}/alcaldes`,
    },
  },
  openGraph: {
    title: `Candidatos a Alcalde 2026 | ${SITE_NAME}`,
    description:
      "Candidatos a la alcaldía de Lima Metropolitana y sus distritos en las elecciones municipales 2026.",
    url: `${SITE_URL}/alcaldes`,
  },
};

export default async function AlcaldesPage() {
  const candidatos = await obtenerResumenMunicipal(AMBITO_PROVINCIAL);
  const conDatos = distritosConCandidatos();

  return (
    <div className="min-h-screen bg-gray-950">
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl sm:text-3xl font-black mb-2 text-white uppercase tracking-wider">
            Alcaldía de Lima Metropolitana 2026
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mb-6">
            {candidatos.length} postulantes a la alcaldía provincial · elección del{" "}
            {ELECCION.fecha}. Selecciona un candidato para ver sus noticias, denuncias
            y sentencias.
          </p>

          {candidatos.length > 0 ? (
            <CandidatosList candidatos={candidatos} basePath="/alcaldes" />
          ) : (
            <SinDatosEleccion />
          )}

          <h2 className="mt-14 mb-3 text-lg sm:text-xl font-black text-white uppercase tracking-wider">
            Por distrito
          </h2>
          <p className="text-gray-400 text-sm mb-5">
            {conDatos.length} alcaldías distritales en elección. El Cercado se
            gobierna desde la Municipalidad Metropolitana.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {DISTRITOS_LIMA.map((d) => {
              const total = POSTULANTES_POR_AMBITO.get(d.slug) ?? 0;
              return (
                <Link prefetch={false}
                  key={d.slug}
                  href={`/alcaldes/distrito/${d.slug}`}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    total > 0
                      ? "border-gray-700 bg-gray-900/60 text-white hover:border-red-500/70"
                      : "border-gray-800/70 bg-gray-900/30 text-gray-500 hover:border-gray-600"
                  }`}
                >
                  <span className="truncate">{d.nombre}</span>
                  {total > 0 && (
                    <span className="shrink-0 rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-black tabular-nums text-gray-300">
                      {total}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
