import { NextResponse, type NextRequest } from "next/server";
import { obtenerPlanGobierno } from "@/lib/planes-gobierno";

// Ruta dinámica por searchParams: el cacheo va por CDN. Los planes de
// gobierno son prácticamente inmutables durante la campaña.
const CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("candidato")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Falta el candidato" }, { status: 400 });
  }

  try {
    const plan = await obtenerPlanGobierno(slug);
    return NextResponse.json({ plan }, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
