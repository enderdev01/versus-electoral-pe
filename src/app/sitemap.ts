import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { DISTRITOS_LIMA } from "@/lib/municipales";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/versus`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/candidato`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/alcaldes`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/alcaldes/versus`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/apoyanos`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  for (const d of DISTRITOS_LIMA) {
    entries.push({
      url: `${SITE_URL}/alcaldes/distrito/${d.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  try {
    const candidatos = await prisma.candidato.findMany({
      select: { slug: true, updatedAt: true, eleccion: true },
    });

    for (const c of candidatos) {
      const base = c.eleccion === "municipal-2026" ? "/alcaldes" : "/candidato";
      entries.push({
        url: `${SITE_URL}${base}/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  } catch {
    // DB not ready
  }

  return entries;
}
