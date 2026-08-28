import { NextResponse } from "next/server";
import { ejecutarScraping } from "@/lib/scraper";
import { prisma } from "@/lib/db";
import { AMBITO_PROVINCIAL, distritosConCandidatos } from "@/lib/municipales";
import { ELECCIONES, type EleccionId } from "@/lib/elecciones";
import { revalidarCandidatos } from "@/lib/revalidar";

export const maxDuration = 300;

const ELECCION_IDS = new Set<string>(ELECCIONES.map((e) => e.id));

const AMBITOS = [
  AMBITO_PROVINCIAL,
  ...distritosConCandidatos().map((distrito) => distrito.slug),
];

async function ejecutarHistorico() {
  const logs = await prisma.scrapingLog.findMany({
    where: { fuente: { startsWith: "MUNICIPAL_HISTORICO:" }, status: "OK" },
    select: { fuente: true },
  });
  const completados = new Set(logs.map((log) => log.fuente.replace("MUNICIPAL_HISTORICO:", "")));
  const slot = Math.floor(Date.now() / 43_200_000);
  const ambito = AMBITOS.find((item) => !completados.has(item)) ?? AMBITOS[slot % AMBITOS.length];
  const hoy = new Date();
  const hasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + 1));
  const desde = new Date(`${process.env.BACKFILL_MUNICIPAL_DESDE ?? "2016-07-31"}T00:00:00.000Z`);
  const results = await ejecutarScraping({ eleccion: "municipal-2026", ambito, desde, hasta });
  return { ambito, desde: desde.toISOString(), hasta: hasta.toISOString(), results };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const isDev = process.env.NODE_ENV === "development";

  if (!isDev) {
    const authHeader = request.headers.get("authorization");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const params = new URL(request.url).searchParams;
    const historico = params.get("modo") === "historico";

    // Sin ?eleccion, ejecutarScraping cae en la ventana municipal rotativa. Los
    // presidenciales solo se scrapean si alguien pide su elección explícitamente,
    // así que el disparador del workflow tiene que pasarla.
    const eleccionParam = params.get("eleccion");
    if (eleccionParam && !ELECCION_IDS.has(eleccionParam)) {
      return NextResponse.json(
        { success: false, error: `Elección desconocida: ${eleccionParam}` },
        { status: 400 }
      );
    }
    const eleccion = (eleccionParam ?? undefined) as EleccionId | undefined;

    const results = historico
      ? await ejecutarHistorico()
      : await ejecutarScraping(eleccion ? { eleccion } : {});

    // Las páginas tienen un revalidate diario como red de seguridad; acá
    // invalidamos al instante solo las rutas de los candidatos que cambiaron,
    // en lugar de dejar que cada crawler dispare una escritura de ISR.
    const actualizados = "actualizados" in results
      ? results.actualizados
      : results.results.actualizados;
    const revalidadas = revalidarCandidatos(actualizados);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
      revalidadas,
    });
  } catch (error) {
    console.error("Cron scraping error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
