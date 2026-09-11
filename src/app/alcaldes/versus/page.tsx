import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { MunicipalEntry } from "@/components/MunicipalEntry";
import { VersusMunicipal } from "@/components/VersusMunicipal";
import { candidatosPorAmbito, obtenerOpcionesMunicipales } from "@/lib/municipales";
import { parseMunicipalComparisonQuery } from "@/lib/municipal-entry";

export const metadata: Metadata = {
  title: "Compara candidaturas municipales",
  description:
    "Elige una municipalidad para contrastar candidaturas, propuestas oficiales del JNE y noticias como contexto.",
  alternates: {
    canonical: `${SITE_URL}/alcaldes/versus`,
    languages: {
      "x-default": `${SITE_URL}/alcaldes/versus`,
      es: `${SITE_URL}/alcaldes/versus`,
    },
  },
  openGraph: {
    title: `Comparación municipal | ${SITE_NAME}`,
    description: "Contrasta candidaturas y propuestas oficiales de una municipalidad.",
    url: `${SITE_URL}/alcaldes/versus`,
  },
};

type SearchParams = Promise<{ ambito?: string | string[]; prioridad?: string | string[] }>;

export default async function AlcaldesVersusPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const options = obtenerOpcionesMunicipales();
  const query = parseMunicipalComparisonQuery(
    await searchParams,
    new Set(options.map((option) => option.slug)),
  );

  if (query.status !== "valid") {
    return (
      <div className="min-h-screen bg-gray-950 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <MunicipalEntry
            autoFocus={query.status === "invalid"}
            error={query.status === "invalid" ? query.message : undefined}
            options={options}
            resetHref="/alcaldes/versus"
          />
        </div>
      </div>
    );
  }

  const option = options.find((item) => item.slug === query.ambito);
  if (!option) {
    // Defensive: keep the public route recoverable if the source catalog changes.
    return (
      <div className="min-h-screen bg-gray-950 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <MunicipalEntry error="La municipalidad indicada ya no está disponible." options={options} resetHref="/alcaldes/versus" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <VersusMunicipal
        key={query.ambito}
        ambito={query.ambito}
        municipalityName={option.nombre}
        rosterSlugs={candidatosPorAmbito(query.ambito).map((candidate) => candidate.slug)}
        options={options}
        priority={query.prioridad}
        notice={query.notice}
      />
    </div>
  );
}
