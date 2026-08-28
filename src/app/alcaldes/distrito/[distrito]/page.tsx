import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { CandidatosList } from "@/components/CandidatosList";
import { SinDatosEleccion } from "@/components/SinDatosEleccion";
import { obtenerResumenMunicipal } from "@/lib/candidatos-resumen";
import { DISTRITOS_LIMA, DISTRITO_BY_SLUG } from "@/lib/municipales";

// El cron invalida estas rutas con revalidatePath cuando el scraping trae algo
// nuevo. Este TTL es solo la red de seguridad por si esa invalidación no corre.
export const revalidate = 86400;

export function generateStaticParams() {
  return DISTRITOS_LIMA.map((d) => ({ distrito: d.slug }));
}

interface PageProps {
  params: Promise<{ distrito: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { distrito } = await params;
  const d = DISTRITO_BY_SLUG.get(distrito);
  if (!d) return { title: "Distrito no encontrado" };

  const title = `Candidatos a alcalde de ${d.nombre} 2026`;
  const description = `Candidatos a la alcaldía de ${d.nombre} en las elecciones municipales 2026, con su registro de acusaciones, denuncias y sentencias.`;
  const url = `${SITE_URL}/alcaldes/distrito/${d.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url, languages: { "x-default": url, es: url } },
    openGraph: { title: `${title} | ${SITE_NAME}`, description, url },
  };
}

export default async function DistritoPage({ params }: PageProps) {
  const { distrito } = await params;
  const d = DISTRITO_BY_SLUG.get(distrito);
  if (!d) notFound();

  const candidatos = await obtenerResumenMunicipal(d.slug);

  return (
    <div className="min-h-screen bg-gray-950">
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <Link prefetch={false}
            href="/alcaldes"
            className="text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300"
          >
            ← Todos los distritos
          </Link>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black mb-2 text-white uppercase tracking-wider">
            {d.sinAlcaldiaPropia ? d.nombre : `Alcaldía de ${d.nombre} 2026`}
          </h1>
          <p className="text-gray-400 text-sm sm:text-base mb-6">
            {d.sinAlcaldiaPropia
              ? "Este distrito vota por la alcaldía provincial de Lima."
              : `${candidatos.length} candidatos a alcalde distrital de ${d.nombre}.`}
          </p>

          {d.sinAlcaldiaPropia ? (
            <SinDatosEleccion
              titulo="El Cercado no elige alcalde distrital"
              detalle="Lima (Cercado) lo administra la Municipalidad Metropolitana de Lima: sus votantes eligen la alcaldía provincial."
              ctaHref="/alcaldes"
              ctaLabel="Ver candidatos a Lima Metropolitana"
            />
          ) : candidatos.length > 0 ? (
            <CandidatosList candidatos={candidatos} basePath="/alcaldes" />
          ) : (
            <SinDatosEleccion
              detalle={`Todavía no hay candidatos inscritos cargados para ${d.nombre}. Los publicaremos cuando el JNE difunda las listas.`}
            />
          )}
        </div>
      </section>
    </div>
  );
}
