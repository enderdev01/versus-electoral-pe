import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Ruta dinámica por searchParams: el cacheo va por CDN, no por ISR.
const CACHE = "public, s-maxage=1800, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const candidatoSlug = searchParams.get("candidato");
  const gravedad = searchParams.get("gravedad");
  const tipo = searchParams.get("tipo");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  try {
    const where: Record<string, unknown> = {};

    if (candidatoSlug) {
      const candidato = await prisma.candidato.findUnique({ where: { slug: candidatoSlug } });
      if (candidato) where.candidatoId = candidato.id;
    }
    if (gravedad) where.gravedad = gravedad;
    if (tipo) where.tipo = tipo;

    const [noticias, total] = await Promise.all([
      prisma.noticia.findMany({
        where,
        include: { candidato: { select: { nombre: true, partido: true, slug: true } } },
        orderBy: { fechaNoticia: { sort: "desc", nulls: "last" } },
        skip,
        take: limit,
      }),
      prisma.noticia.count({ where }),
    ]);

    return NextResponse.json(
      {
        noticias,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
      { headers: { "Cache-Control": CACHE } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
