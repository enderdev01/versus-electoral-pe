import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CANDIDATOS, type GravedadKey } from "@/lib/candidatos";
import { CandidatoDetalleClient } from "@/components/CandidatoDetalleClient";
import { SITE_URL, SITE_NAME } from "@/lib/site";

// El cron invalida estas rutas con revalidatePath cuando el scraping trae algo
// nuevo. Este TTL es solo la red de seguridad por si esa invalidación no corre.
export const revalidate = 86400;

export function generateStaticParams() {
  return CANDIDATOS.map((c) => ({ slug: c.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  let candidato: { nombre: string; partido: string } | null = null;
  try {
    candidato = await prisma.candidato.findUnique({
      where: { slug },
      select: { nombre: true, partido: true },
    });
  } catch { /* DB not ready */ }

  if (!candidato) return { title: "Candidato no encontrado" };

  const title = `${candidato.nombre} — Denuncias y Acusaciones`;
  const description = `Registro de acusaciones, denuncias y sentencias de ${candidato.nombre} (${candidato.partido}). Información recopilada de fuentes periodísticas peruanas.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/candidato/${slug}`,
      languages: { "x-default": `${SITE_URL}/candidato/${slug}`, es: `${SITE_URL}/candidato/${slug}` },
    },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/candidato/${slug}`,
    },
  };
}

const ORDEN_GRAVEDAD: GravedadKey[] = ["MUY_PELIGROSO", "PELIGROSO", "MODERADO", "LEVE", "LIMPIO"];

export default async function CandidatoPage({ params }: PageProps) {
  const { slug } = await params;

  let candidato: {
    id: number; nombre: string; partido: string; slug: string;
    noticias: Array<{
      id: number; titulo: string; descripcion: string;
      url: string; fuente: string; gravedad: string; tipo: string;
      fechaNoticia: Date | null;
    }>;
  } | null = null;

  try {
    candidato = await prisma.candidato.findUnique({
      where: { slug },
      include: { noticias: { orderBy: { fechaNoticia: { sort: "desc", nulls: "last" } }, take: 200 } },
    });
  } catch { /* DB not ready */ }

  if (!candidato) notFound();

  const gravedadCounts: Record<string, number> = {};
  for (const n of candidato.noticias) {
    gravedadCounts[n.gravedad] = (gravedadCounts[n.gravedad] || 0) + 1;
  }

  let peorGravedad: GravedadKey = "LIMPIO";
  for (const g of ORDEN_GRAVEDAD) {
    if (gravedadCounts[g]) {
      peorGravedad = g;
      break;
    }
  }

  const personStructuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: candidato.nombre,
    description: `Candidato presidencial del Perú 2026 por ${candidato.partido}`,
    affiliation: { "@type": "Organization", name: candidato.partido },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personStructuredData) }}
      />
      <CandidatoDetalleClient
        slug={slug}
        nombre={candidato.nombre}
        partido={candidato.partido}
        peorGravedad={peorGravedad}
        gravedadCounts={gravedadCounts}
        noticias={candidato.noticias.map((n) => ({
          id: n.id,
          titulo: n.titulo,
          descripcion: n.descripcion,
          url: n.url,
          fuente: n.fuente,
          gravedad: n.gravedad,
          tipo: n.tipo,
          fechaNoticia: n.fechaNoticia?.toISOString() ?? null,
        }))}
      />
    </>
  );
}
