import { NextResponse, type NextRequest } from "next/server";
import { obtenerResumenCandidatos } from "@/lib/candidatos-resumen";
import { ELECCIONES, ELECCION_DEFAULT, type EleccionId } from "@/lib/elecciones";

// Leer searchParams hace la ruta dinámica, así que un `revalidate` acá no
// aplica. El cacheo lo hace el CDN con Cache-Control en la respuesta.
const CACHE = "public, s-maxage=1800, stale-while-revalidate=86400";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const pedida = q.get("eleccion");
    const eleccion: EleccionId = ELECCIONES.some((e) => e.id === pedida)
      ? (pedida as EleccionId)
      : ELECCION_DEFAULT;
    const ambito = q.get("ambito") ?? undefined;

    const result = await obtenerResumenCandidatos({ eleccion, ambito });
    return NextResponse.json(result, { headers: { "Cache-Control": CACHE } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error interno" },
      { status: 500 }
    );
  }
}
