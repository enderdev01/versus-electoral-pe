"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ConteoStanding } from "@/lib/conteo-oficial";
import type { ExitPollStanding } from "@/lib/exit-poll";
import { CandidatoAvatar } from "./CandidatoAvatar";
import { GravedadBadge } from "./GravedadBadge";
import { NoticiaItem } from "./NoticiaItem";
import { PlanGobierno } from "./PlanGobierno";
import { GRAVEDAD, type GravedadKey } from "@/lib/candidatos";
import type { PlanGobiernoView } from "@/lib/planes-gobierno";

const ORDEN_GRAVEDAD: GravedadKey[] = ["MUY_PELIGROSO", "PELIGROSO", "MODERADO", "LEVE", "LIMPIO"];

interface NoticiaView {
  id: number;
  titulo: string;
  descripcion: string;
  url: string;
  fuente: string;
  gravedad: string;
  tipo: string;
  fechaNoticia: string | null;
}

interface CandidatoDetalleClientProps {
  slug: string;
  nombre: string;
  partido: string;
  peorGravedad: GravedadKey;
  gravedadCounts: Record<string, number>;
  noticias: NoticiaView[];
  planGobierno?: PlanGobiernoView | null;
  basePath?: string;
  /** Municipal only: link to the versus flow preselecting this candidate's ámbito. */
  compareHref?: string;
  /** Label for the compare link, e.g. "Santiago de Surco" or "Lima Metropolitana". */
  compareZonaLabel?: string;
  /** Election night: this candidate's position in each published exit poll. */
  exitPoll?: ExitPollStanding[];
  /** Election night: this candidate's position in the official ONPE count. */
  conteo?: ConteoStanding | null;
}

export function CandidatoDetalleClient({
  slug,
  nombre,
  partido,
  peorGravedad,
  gravedadCounts,
  noticias,
  planGobierno = null,
  basePath = "/candidato",
  compareHref,
  compareZonaLabel,
  exitPoll = [],
  conteo = null,
}: CandidatoDetalleClientProps) {
  const [gravedadSeleccionada, setGravedadSeleccionada] = useState<GravedadKey | null>(null);
  const [busqueda, setBusqueda] = useState("");

  // El preselector ?gravedad= se lee en el cliente a propósito: si la página
  // servidora leyera searchParams, Next la marcaría dinámica y cada una de las
  // ~485 fichas se renderizaría por request en vez de servirse desde la CDN.
  //
  // Tampoco sirve useSearchParams(): en una ruta estática obliga a envolver esto
  // en <Suspense>, y entonces la ficha entera deja de prerenderizarse (pérdida de
  // SEO en 485 páginas). Leer la URL una vez tras montar es justo el caso de
  // "sincronizar con un sistema externo" que el efecto existe para cubrir.
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("gravedad");
    if (g && ORDEN_GRAVEDAD.includes(g as GravedadKey)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGravedadSeleccionada(g as GravedadKey);
    }
  }, []);

  const noticiasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return noticias.filter((n) => {
      if (gravedadSeleccionada && n.gravedad !== gravedadSeleccionada) return false;
      if (!q) return true;
      return (
        n.titulo.toLowerCase().includes(q)
        || n.descripcion.toLowerCase().includes(q)
        || n.fuente.toLowerCase().includes(q)
      );
    });
  }, [noticias, gravedadSeleccionada, busqueda]);

  return (
    <div className="min-h-screen bg-gray-950">
      <section className="py-12 px-4">
        <div className="mx-auto max-w-4xl">
          {/* Breadcrumb */}
          <nav className="mb-6 text-xs sm:text-sm text-gray-500 flex items-center gap-1.5 flex-wrap">
            <Link prefetch={false} href="/" className="hover:text-white transition-colors">Inicio</Link>
            <span className="text-gray-700">/</span>
            <Link prefetch={false} href={basePath} className="hover:text-white transition-colors">Candidatos</Link>
            <span className="text-gray-700">/</span>
            <span className="text-gray-300 font-medium truncate max-w-[200px] sm:max-w-none">{nombre}</span>
          </nav>

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-8">
            <CandidatoAvatar
              slug={slug}
              nombre={nombre}
              size={80}
              className="rounded-xl border-3 shrink-0 sm:!w-[112px] sm:!h-[112px]"
              style={{
                borderColor: GRAVEDAD[peorGravedad].color,
                boxShadow: `0 0 20px ${GRAVEDAD[peorGravedad].color}25`,
              }}
            />
            <div className="text-center sm:text-left">
              <h1 className="text-xl sm:text-3xl font-black text-white">{nombre}</h1>
              <p className="mt-0.5 text-sm sm:text-lg text-gray-400">{partido}</p>
              {conteo && (
                <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:justify-start sm:text-sm">
                  <span className="font-bold uppercase tracking-wider text-red-500">Conteo ONPE</span>
                  <span className="font-bold tabular-nums text-white">
                    {conteo.puesto === 1 ? "Ganador · " : `${conteo.puesto}.º · `}{formatPct(conteo.porcentaje)}%
                  </span>
                  <span className="text-gray-500">{formatPct(conteo.actasPct)}% de actas</span>
                </p>
              )}
              {exitPoll.length > 0 && (
                <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:justify-start sm:text-sm">
                  <span className="font-bold uppercase tracking-wider text-red-500">Boca de urna</span>
                  {exitPoll.map((e) => (
                    <span key={e.fuente} className="text-gray-300">
                      <span className="font-bold tabular-nums text-white">
                        {e.puesto}.º · {formatPct(e.porcentaje)}%
                      </span>{" "}
                      <span className="text-gray-500">{e.fuente}</span>
                    </span>
                  ))}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 sm:gap-3 justify-center sm:justify-start">
                <GravedadBadge gravedad={peorGravedad} />
                <span className="text-xs sm:text-sm text-gray-500">
                  {noticiasFiltradas.length} noticia{noticiasFiltradas.length !== 1 ? "s" : ""}
                  {gravedadSeleccionada ? ` (${GRAVEDAD[gravedadSeleccionada].label})` : ""}
                </span>
              </div>
            </div>
          </div>

          {compareHref && (
            <div className="mb-8 text-center sm:text-left">
              <Link
                prefetch={false}
                href={compareHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gray-700 bg-gray-900/70 px-5 py-2.5 text-sm font-bold text-gray-200 transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:border-red-500/60 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white active:scale-[0.97]"
              >
                Comparar con otro candidato de {compareZonaLabel}
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}

          {planGobierno && (
            <section className="mb-10 rounded-2xl border border-gray-800/70 bg-gray-950/60 p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-gray-800/60 pb-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">
                    Fuente oficial JNE
                  </p>
                  <h2 className="mt-1 text-base font-black uppercase tracking-[0.12em] text-white">
                    Propuestas y plan de gobierno
                  </h2>
                </div>
                <span className="text-xs font-bold text-gray-400">
                  {planGobierno.propuestas.length} propuestas
                </span>
              </div>
              <PlanGobierno plan={planGobierno} />
            </section>
          )}

          {/* Search local */}
          <div className="mb-5">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en noticias..."
              className="w-full rounded-xl bg-gray-900/60 border border-gray-800/60 text-white text-sm px-4 py-2.5 placeholder-gray-500 focus:outline-none focus:border-gray-600 transition-colors"
            />
          </div>

          {/* Gravedad breakdown */}
          {Object.keys(gravedadCounts).length > 0 && (
            <div className="mb-8 grid grid-cols-5 gap-1.5 sm:gap-2.5">
              {ORDEN_GRAVEDAD.map((g) => {
                const active = gravedadSeleccionada === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGravedadSeleccionada(active ? null : g)}
                    className={`group rounded-lg sm:rounded-xl border bg-gray-900/50 p-2 sm:p-3.5 text-center transition-all duration-200 ${
                      active
                        ? "border-white/30 ring-1 ring-white/20 bg-gray-900"
                        : "border-gray-800/60 hover:border-gray-600 hover:bg-gray-900"
                    }`}
                    title={`Filtrar por ${GRAVEDAD[g].label}`}
                  >
                    <p className="text-lg sm:text-2xl font-black transition-transform duration-200 group-hover:scale-110" style={{ color: GRAVEDAD[g].color }}>
                      {gravedadCounts[g] || 0}
                    </p>
                    <p className="text-[9px] sm:text-[11px] text-gray-500 mt-0.5 leading-tight">{GRAVEDAD[g].label}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Noticias */}
          <h2 className="text-base font-black uppercase tracking-[0.15em] text-white mb-5 border-b border-gray-800/60 pb-3">
            Noticias y Registros
          </h2>

          {noticiasFiltradas.length > 0 ? (
            <div className="space-y-3">
              {noticiasFiltradas.map((n) => (
                <NoticiaItem
                  key={n.id}
                  titulo={n.titulo}
                  descripcion={n.descripcion}
                  url={n.url}
                  fuente={n.fuente}
                  gravedad={n.gravedad}
                  tipo={n.tipo}
                  fechaNoticia={n.fechaNoticia}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-700/60 p-10 text-center">
              <p className="text-gray-500 text-sm">
                {gravedadSeleccionada
                  ? `No hay noticias para la gravedad ${GRAVEDAD[gravedadSeleccionada].label}${busqueda ? " con ese término de búsqueda" : ""}.`
                  : busqueda
                    ? "No hay noticias que coincidan con esa búsqueda."
                    : "No se han encontrado noticias relevantes."}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatPct(n: number): string {
  return n.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
