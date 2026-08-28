"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { VelocimetroVersus } from "./Velocimetro";
import { GravedadBadge } from "./GravedadBadge";
import { GRAVEDAD, type GravedadKey } from "@/lib/candidatos";
import { normalize } from "@/lib/normalize";
import type { EleccionId } from "@/lib/elecciones";
import { trackEvent } from "./GoogleAnalytics";
import { PlanGobierno } from "./PlanGobierno";
import { CandidatoAvatar } from "./CandidatoAvatar";
import type { PlanGobiernoView } from "@/lib/planes-gobierno";

interface CandidatoAPI {
  id: number;
  nombre: string;
  partido: string;
  slug: string;
  totalNoticias: number;
  peorGravedad: string;
  gravedadCounts: Record<string, number>;
}

interface NoticiaAPI {
  id: number;
  titulo: string;
  descripcion: string;
  url: string;
  fuente: string;
  gravedad: string;
  tipo: string;
  fechaNoticia: string | null;
}

const GRAVEDAD_SCORE: Record<string, number> = {
  LIMPIO: 0, LEVE: 1, MODERADO: 2, PELIGROSO: 3, MUY_PELIGROSO: 4,
};

const TIPO_LABELS: Record<string, string> = {
  SENTENCIA: "Sentencia",
  ACUSACION: "Acusación",
  DENUNCIA: "Denuncia",
  INVESTIGACION: "Investigación",
  LIMPIO: "Sin hallazgos",
};

function formatFecha(fecha: string | null): string {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "";

  const MESES = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  const day = d.getUTCDate();
  const month = MESES[d.getUTCMonth()];
  const year = d.getUTCFullYear();

  return `${day} ${month} ${year}`;
}

/* ── Searchable Select Dropdown ── */
function SearchableSelect({
  value,
  onChange,
  options,
  disabledValue,
  placeholder,
  accentColor = "red",
}: {
  value: string;
  onChange: (val: string) => void;
  options: CandidatoAPI[];
  disabledValue: string;
  placeholder: string;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((c) => c.slug === value);

  const filtered = options.filter((c) => {
    if (c.slug === disabledValue) return false;
    if (!search) return true;
    const q = normalize(search);
    return normalize(c.nombre).includes(q) || normalize(c.partido).includes(q);
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(slug: string) {
    onChange(slug);
    setOpen(false);
    setSearch("");
  }

  function handleOpen() {
    setOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const borderColor = accentColor === "red" ? "border-red-500" : "border-blue-500";
  const focusColor = accentColor === "red" ? "focus:border-red-500" : "focus:border-blue-500";

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full rounded-xl border-2 border-gray-700/80 bg-gray-900/80 text-white px-3.5 py-2.5 sm:py-3 text-left flex items-center justify-between gap-2 h-[60px] sm:h-[72px] ${focusColor} focus:outline-none transition-colors hover:border-gray-600 ${open ? borderColor : ""}`}
      >
        {selected ? (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate leading-snug">{selected.nombre}</p>
            <p className="text-[11px] text-gray-500 truncate mt-0.5">{selected.partido}</p>
          </div>
        ) : (
          <span className="text-sm text-gray-500">{placeholder}</span>
        )}
        <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <>
        {/* Mobile backdrop */}
        <button
          type="button"
          aria-label="Cerrar selector"
          tabIndex={-1}
          className="fixed inset-0 z-30 bg-black/60 sm:hidden cursor-default"
          onClick={() => { setOpen(false); setSearch(""); }}
        />
        <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl sm:rounded-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:mt-1 sm:w-full border border-gray-700/80 bg-gray-900 shadow-2xl shadow-black/40 overflow-hidden animate-slide-down">
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-600" />
          </div>
          {/* Search input */}
          <div className="p-2.5 border-b border-gray-800">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar candidato..."
              className="w-full rounded-lg bg-gray-800/80 border border-gray-700 text-white text-sm px-3 py-2.5 placeholder-gray-500 focus:outline-none focus:border-gray-500 transition-colors"
            />
          </div>

          {/* Options list */}
          <div className="max-h-[50vh] sm:max-h-[280px] overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => handleSelect(c.slug)}
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-white/5 transition-colors ${c.slug === value ? "bg-white/5" : ""}`}
                >
                  <CandidatoAvatar
                    slug={c.slug}
                    nombre={c.nombre}
                    size={36}
                    className="rounded-full shrink-0 border border-gray-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{c.nombre}</p>
                    <p className="text-[11px] text-gray-500 truncate">{c.partido}</p>
                  </div>
                  <GravedadBadge gravedad={c.peorGravedad} />
                </button>
              ))
            ) : (
              <p className="px-3 py-4 text-sm text-gray-500 text-center">No se encontraron candidatos</p>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

function VersusPhoto({ slug, nombre, side }: { slug: string; nombre: string; side: "left" | "right" }) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <CandidatoAvatar slug={slug} nombre={nombre} fill className="[&_img]:object-top" />
      {/* Fade toward center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(${side === "left" ? "to right" : "to left"}, transparent 30%, rgba(3,7,18,0.85) 85%, rgba(3,7,18,1) 100%)`,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(3,7,18,0.9) 0%, transparent 50%)" }}
      />
    </div>
  );
}

/* ── Winner Modal ── */
function WinnerModal({
  winner,
  loser,
  topNoticias,
  basePath,
  onClose,
}: {
  winner: CandidatoAPI;
  loser: CandidatoAPI;
  topNoticias: NoticiaAPI[];
  basePath: string;
  onClose: () => void;
}) {
  const [show, setShow] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setShow(true));
    const t = setTimeout(() => setShowContent(true), 400);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setShowContent(false);
    setShow(false);
    setTimeout(onClose, 300);
  }

  const winnerInfo = GRAVEDAD[winner.peorGravedad as GravedadKey];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 overflow-y-auto"
      style={{ transition: "opacity 0.3s", opacity: show ? 1 : 0 }}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar resultado"
        tabIndex={-1}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-default"
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="relative h-[100dvh] sm:h-auto w-full max-w-none sm:max-w-lg rounded-none sm:rounded-2xl border-0 sm:border border-gray-700/60 bg-gray-900 overflow-hidden shadow-2xl shadow-black/50 max-h-[100dvh] sm:max-h-[85vh] overflow-y-auto"
        style={{
          transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s",
          transform: showContent ? "scale(1)" : "scale(0.8)",
          opacity: showContent ? 1 : 0,
        }}
      >
        {/* Red glow top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />

        <div className="p-5 sm:p-8">
          {/* Header */}
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-3">Veredicto</p>

          {/* Winner photo + info */}
          <div className="flex flex-col items-center mb-4 sm:mb-6">
            <div
              className="relative h-20 w-20 sm:h-28 sm:w-28 rounded-xl sm:rounded-2xl overflow-hidden border-3 sm:border-4 mb-3"
              style={{
                borderColor: winnerInfo?.color || "#dc2626",
                boxShadow: `0 0 30px ${winnerInfo?.color || "#dc2626"}30`,
              }}
            >
              <CandidatoAvatar
                slug={winner.slug}
                nombre={winner.nombre}
                fill
                className="[&_img]:object-top"
              />
            </div>
            <h3 className="text-lg sm:text-2xl font-black text-white text-center">{winner.nombre}</h3>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">{winner.partido}</p>
            <div className="mt-2 flex items-center gap-2">
              <GravedadBadge gravedad={winner.peorGravedad} />
              <span className="text-xs text-gray-500">{winner.totalNoticias} noticias</span>
            </div>
          </div>

          {/* Verdict text */}
          <div
            className="text-center mb-4 sm:mb-6 px-3 py-2.5 rounded-lg sm:rounded-xl"
            style={{ backgroundColor: (winnerInfo?.color || "#dc2626") + "15" }}
          >
            <p className="text-sm sm:text-lg font-black uppercase" style={{ color: winnerInfo?.color || "#dc2626" }}>
              Es más peligroso que {loser.nombre.split(" ")[0]}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
              Clasificado como <strong style={{ color: winnerInfo?.color }}>{winnerInfo?.label}</strong> con {winner.totalNoticias} noticias
              vs <strong>{loser.totalNoticias}</strong> de {loser.nombre.split(" ")[0]}
            </p>
          </div>

          {/* Top noticias */}
          {topNoticias.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 font-bold">
                Top noticias que lo decretan peligroso
              </p>
              <div className="space-y-1.5 max-h-[180px] sm:max-h-[200px] overflow-y-auto pr-1">
                {topNoticias.slice(0, 5).map((n, i) => (
                  <a
                    key={n.id}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-lg border border-gray-700 bg-gray-800/50 p-2.5 sm:p-3 hover:border-gray-500 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                      <span className="text-[10px] font-bold text-gray-500">#{i + 1}</span>
                      <GravedadBadge gravedad={n.gravedad} />
                      <span className="text-[10px] text-gray-500">{TIPO_LABELS[n.tipo] || n.tipo}</span>
                      <span className="text-[10px] text-gray-600 ml-auto hidden sm:inline">{n.fuente}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white line-clamp-2 leading-snug">{n.titulo}</p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-2 sm:gap-3">
            <a
              href={`${basePath}/${winner.slug}`}
              className="flex-1 text-center py-2.5 sm:py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors"
            >
              Ver todas las noticias
            </a>
            <button
              onClick={handleClose}
              className="flex-1 py-2.5 sm:py-3 rounded-xl border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 hover:bg-white/5 font-semibold text-sm transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Selector ── */
export function VersusSelector({
  eleccion = "presidencial-2026",
  ambito,
}: {
  eleccion?: EleccionId;
  /** Solo municipales: lima-metropolitana o slug de distrito */
  ambito?: string;
} = {}) {
  const [candidatos, setCandidatos] = useState<CandidatoAPI[]>([]);
  const [left, setLeft] = useState<string>("");
  const [right, setRight] = useState<string>("");
  const [leftNoticias, setLeftNoticias] = useState<NoticiaAPI[]>([]);
  const [rightNoticias, setRightNoticias] = useState<NoticiaAPI[]>([]);
  const [leftPlan, setLeftPlan] = useState<PlanGobiernoView | null>(null);
  const [rightPlan, setRightPlan] = useState<PlanGobiernoView | null>(null);
  const [comparing, setComparing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [comparedLeft, setComparedLeft] = useState("");
  const [comparedRight, setComparedRight] = useState("");
  const [comparisonKey, setComparisonKey] = useState(0);
  const selectorSectionRef = useRef<HTMLElement>(null);
  const resultsSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const q = new URLSearchParams({ eleccion });
    if (ambito) q.set("ambito", ambito);
    fetch(`/api/candidatos?${q}`)
      .then((r) => r.json())
      .then((data) => setCandidatos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [eleccion, ambito]);

  const lista = Array.isArray(candidatos) ? candidatos : [];
  const leftData = lista.find((c) => c.slug === left);
  const rightData = lista.find((c) => c.slug === right);

  const handleGaugeFinish = useCallback(() => {
    setLoading(false);
    setShowResults(true);
    // Show modal after a small delay
    setTimeout(() => setShowModal(true), 600);
  }, []);


  const startComparisonRef = useRef<(l: string, r: string) => Promise<void>>(undefined);
  startComparisonRef.current = async (l: string, r: string) => {
    if (!l || !r || l === r) return;
    const leftName = lista.find((c) => c.slug === l)?.nombre || l;
    const rightName = lista.find((c) => c.slug === r)?.nombre || r;
    trackEvent("comparar_candidatos", {
      candidato_1: leftName,
      candidato_2: rightName,
      candidato_1_slug: l,
      candidato_2_slug: r,
    });
    setLoading(true);
    setComparing(true);
    setShowResults(false);
    setShowModal(false);
    window.scrollTo({ top: 0, behavior: "smooth" });

    const [lRes, rRes, lPlanRes, rPlanRes] = await Promise.all([
      fetch(`/api/noticias?candidato=${l}&limit=50`).then((r) => r.json()),
      fetch(`/api/noticias?candidato=${r}&limit=50`).then((r) => r.json()),
      fetch(`/api/propuestas?candidato=${l}`).then((r) => r.json()),
      fetch(`/api/propuestas?candidato=${r}`).then((r) => r.json()),
    ]);

    const gravedadOrder = ["MUY_PELIGROSO", "PELIGROSO", "MODERADO", "LEVE", "LIMPIO"];
    const sortByGravedad = (a: NoticiaAPI, b: NoticiaAPI) =>
      gravedadOrder.indexOf(a.gravedad) - gravedadOrder.indexOf(b.gravedad);

    setLeftNoticias((lRes.noticias || []).sort(sortByGravedad));
    setRightNoticias((rRes.noticias || []).sort(sortByGravedad));
    setLeftPlan(lPlanRes.plan || null);
    setRightPlan(rPlanRes.plan || null);
    setComparedLeft(l);
    setComparedRight(r);
    setComparisonKey((k) => k + 1);
  };

  async function startComparison() {
    await startComparisonRef.current?.(left, right);
  }

  // Auto-compare when candidates change while in comparing mode
  useEffect(() => {
    if (comparing && left && right && left !== right && (left !== comparedLeft || right !== comparedRight)) {
      startComparisonRef.current?.(left, right);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, right, comparing]);

  function reset() {
    setLeft("");
    setRight("");
    setComparing(false);
    setShowResults(false);
    setShowModal(false);
    setLeftNoticias([]);
    setRightNoticias([]);
    setLeftPlan(null);
    setRightPlan(null);
    requestAnimationFrame(() => {
      selectorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Determine winner
  const winner = leftData && rightData ? (() => {
    const ls = GRAVEDAD_SCORE[leftData.peorGravedad] ?? 0;
    const rs = GRAVEDAD_SCORE[rightData.peorGravedad] ?? 0;
    if (ls > rs) return "left";
    if (rs > ls) return "right";
    if (leftData.totalNoticias > rightData.totalNoticias) return "left";
    if (rightData.totalNoticias > leftData.totalNoticias) return "right";
    return "tie";
  })() : "tie";

  const winnerData = winner === "left" ? leftData : winner === "right" ? rightData : null;
  const loserData = winner === "left" ? rightData : winner === "right" ? leftData : null;
  const winnerNoticias = winner === "left" ? leftNoticias : rightNoticias;

  return (
    <div>
      {/* ── Selector ── */}
      {!comparing && (
        <section ref={selectorSectionRef} className="py-4 sm:py-10 px-4 scroll-mt-24">
          <div className="mx-auto max-w-5xl">
            <Link prefetch={false}
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-3 sm:mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black text-white text-center uppercase tracking-wider mb-1 sm:mb-2">
              Versus
            </h1>
            <p className="text-center text-gray-400 text-sm mb-4 sm:mb-8">
              Selecciona dos candidatos y descubre quién es más peligroso
            </p>

            {/* Face-off preview */}
            {leftData && rightData && (
              <div className="relative mb-4 sm:mb-8 h-[180px] sm:h-[300px] md:h-[420px] rounded-2xl overflow-hidden border border-gray-800">
                <div className="absolute inset-y-0 left-0 w-1/2">
                  <VersusPhoto slug={left} nombre={leftData.nombre} side="left" />
                  <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 z-10 max-w-[85%]">
                    <p className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight drop-shadow-lg line-clamp-2">
                      {leftData.nombre}
                    </p>
                    <p className="hidden sm:block text-xs text-gray-300 mt-1 line-clamp-1">{leftData.partido}</p>
                    <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
                      <GravedadBadge gravedad={leftData.peorGravedad} />
                      <span className="text-[11px] sm:text-xs text-gray-400">{leftData.totalNoticias} noticias</span>
                    </div>
                  </div>
                </div>

                <div className="absolute inset-y-0 right-0 w-1/2">
                  <VersusPhoto slug={right} nombre={rightData.nombre} side="right" />
                  <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 z-10 text-right max-w-[85%] ml-auto">
                    <p className="text-lg sm:text-xl md:text-2xl font-black text-white leading-tight drop-shadow-lg line-clamp-2">
                      {rightData.nombre}
                    </p>
                    <p className="hidden sm:block text-xs text-gray-300 mt-1 line-clamp-1">{rightData.partido}</p>
                    <div className="flex items-center gap-2 mt-1.5 sm:mt-2 justify-end">
                      <span className="text-[11px] sm:text-xs text-gray-400">{rightData.totalNoticias} noticias</span>
                      <GravedadBadge gravedad={rightData.peorGravedad} />
                    </div>
                  </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                  <div
                    className="w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-red-600 flex items-center justify-center animate-pulse-glow"
                    style={{ boxShadow: "0 0 40px rgba(220,38,38,0.7)" }}
                  >
                    <span className="text-2xl sm:text-3xl md:text-4xl font-black text-white italic">VS</span>
                  </div>
                </div>
              </div>
            )}

            {/* Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2.5 sm:gap-6 items-end">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-red-500 mb-1 sm:mb-2">
                  Candidato 1
                </label>
                <SearchableSelect
                  value={left}
                  onChange={setLeft}
                  options={lista}
                  disabledValue={right}
                  placeholder="Seleccionar candidato..."
                  accentColor="red"
                />
              </div>

              <div className="flex flex-col items-center justify-center py-1 sm:py-4">
                <span className="text-3xl sm:text-4xl font-black text-red-500 italic" style={{ textShadow: "0 0 20px rgba(220,38,38,0.5)" }}>
                  VS
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-blue-500 mb-1 sm:mb-2">
                  Candidato 2
                </label>
                <SearchableSelect
                  value={right}
                  onChange={setRight}
                  options={lista}
                  disabledValue={left}
                  placeholder="Seleccionar candidato..."
                  accentColor="blue"
                />
              </div>
            </div>

            <div className="mt-5 sm:mt-8 text-center">
              <button
                onClick={startComparison}
                disabled={!left || !right || left === right}
                className="w-full sm:w-auto px-10 py-3 sm:py-4 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-black text-lg uppercase tracking-wider rounded-xl transition-all duration-200 transform hover:scale-[1.03] hover:shadow-[0_0_40px_rgba(220,38,38,0.3)] disabled:hover:scale-100 disabled:hover:shadow-none"
              >
                Comparar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Resultados ── */}
      {comparing && leftData && rightData && (
        <section ref={resultsSectionRef} className="px-4 py-6 scroll-mt-24">
          <div className="mx-auto max-w-6xl">
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-4"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>

            {/* ── Mobile layout ── */}
            <div className="md:hidden mb-4">
              {/* Candidates side by side */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Left */}
                <div className="flex flex-col items-center text-center">
                  <div
                    className="relative h-24 w-24 rounded-2xl overflow-hidden border-4 mb-2 shrink-0"
                    style={{
                      borderColor: GRAVEDAD[leftData.peorGravedad as GravedadKey]?.color || "#555",
                      boxShadow: winner === "left" ? `0 0 25px ${GRAVEDAD[leftData.peorGravedad as GravedadKey]?.color}40` : "none",
                    }}
                  >
                    <VersusPhoto slug={left} nombre={leftData.nombre} side="left" />
                  </div>
                  <h3 className="text-sm font-black text-white truncate w-full px-1">{leftData.nombre}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate w-full px-1">{leftData.partido}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <GravedadBadge gravedad={leftData.peorGravedad} />
                    <span className="text-[11px] text-gray-500">{leftData.totalNoticias} noticias</span>
                  </div>
                </div>
                {/* Right */}
                <div className="flex flex-col items-center text-center">
                  <div
                    className="relative h-24 w-24 rounded-2xl overflow-hidden border-4 mb-2 shrink-0"
                    style={{
                      borderColor: GRAVEDAD[rightData.peorGravedad as GravedadKey]?.color || "#555",
                      boxShadow: winner === "right" ? `0 0 25px ${GRAVEDAD[rightData.peorGravedad as GravedadKey]?.color}40` : "none",
                    }}
                  >
                    <VersusPhoto slug={right} nombre={rightData.nombre} side="right" />
                  </div>
                  <h3 className="text-sm font-black text-white truncate w-full px-1">{rightData.nombre}</h3>
                  <p className="text-[11px] text-gray-400 mt-0.5 truncate w-full px-1">{rightData.partido}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <GravedadBadge gravedad={rightData.peorGravedad} />
                    <span className="text-[11px] text-gray-500">{rightData.totalNoticias} noticias</span>
                  </div>
                </div>
              </div>

              {/* Horizontal comparison bar */}
              <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 px-4 py-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase flex-1 text-left truncate">{leftData.nombre.split(" ").slice(0, 2).join(" ")}</span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase flex-1 text-right truncate">{rightData.nombre.split(" ").slice(0, 2).join(" ")}</span>
                </div>
                <div className="relative h-2.5 rounded-full bg-gray-800">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "linear-gradient(to right, #dc2626, #ea580c, #ca8a04, #16a34a, #ca8a04, #ea580c, #dc2626)",
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/danger-svgrepo-com.svg"
                    alt="peligro"
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 z-10 drop-shadow-lg transition-all duration-[2500ms] ease-out"
                    style={{
                      left: winner === "left" ? "15%" : winner === "right" ? "85%" : "50%",
                    }}
                  />
                </div>
                <p className="text-center mt-2.5 text-xs sm:text-sm font-bold" style={{ color: winnerData ? (GRAVEDAD[winnerData.peorGravedad as GravedadKey]?.color || "#dc2626") : "#16a34a" }}>
                  {winner === "tie"
                    ? "Empate"
                    : `${winnerData?.nombre} es más peligroso`}
                </p>
              </div>

              {/* Selectors side by side */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Candidato 1</label>
                  <SearchableSelect
                    value={left}
                    onChange={setLeft}
                    options={lista}
                    disabledValue={right}
                    placeholder="Candidato..."
                    accentColor="red"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Candidato 2</label>
                  <SearchableSelect
                    value={right}
                    onChange={setRight}
                    options={lista}
                    disabledValue={left}
                    placeholder="Candidato..."
                    accentColor="blue"
                  />
                </div>
              </div>
            </div>

            {/* Velocímetro hidden on mobile, needed for onFinish callback */}
            <div className="hidden">
              <VelocimetroVersus
                key={comparisonKey}
                leftGravedad={leftData.peorGravedad as GravedadKey}
                rightGravedad={rightData.peorGravedad as GravedadKey}
                leftNombre={leftData.nombre}
                rightNombre={rightData.nombre}
                leftNoticias={leftData.totalNoticias}
                rightNoticias={rightData.totalNoticias}
                onFinish={handleGaugeFinish}
              />
            </div>

            {/* ── Desktop layout ── */}
            <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] gap-6 items-center mb-4">
              {/* Left candidate card */}
              <div className="flex flex-col items-center text-center md:min-h-[300px]">
                <div
                  className="relative h-40 w-40 rounded-2xl overflow-hidden border-4 mb-3 shrink-0"
                  style={{
                    borderColor: GRAVEDAD[leftData.peorGravedad as GravedadKey]?.color || "#555",
                    boxShadow: winner === "left" ? `0 0 30px ${GRAVEDAD[leftData.peorGravedad as GravedadKey]?.color}40` : "none",
                  }}
                >
                  <VersusPhoto slug={left} nombre={leftData.nombre} side="left" />
                </div>
                <h3 className="text-base font-black text-white line-clamp-2 min-h-[2.5rem] flex items-center justify-center px-2">{leftData.nombre}</h3>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 px-2">{leftData.partido}</p>
                <div className="flex items-center gap-2 mt-2">
                  <GravedadBadge gravedad={leftData.peorGravedad} />
                  <span className="text-xs text-gray-500">{leftData.totalNoticias} noticias</span>
                </div>
              </div>

              {/* Center: Velocímetro (visible) */}
              <div className="flex flex-col items-center">
                <VelocimetroVersus
                  key={`desktop-${comparisonKey}`}
                  leftGravedad={leftData.peorGravedad as GravedadKey}
                  rightGravedad={rightData.peorGravedad as GravedadKey}
                  leftNombre={leftData.nombre}
                  rightNombre={rightData.nombre}
                  leftNoticias={leftData.totalNoticias}
                  rightNoticias={rightData.totalNoticias}
                />
              </div>

              {/* Right candidate card */}
              <div className="flex flex-col items-center text-center md:min-h-[300px]">
                <div
                  className="relative h-40 w-40 rounded-2xl overflow-hidden border-4 mb-3 shrink-0"
                  style={{
                    borderColor: GRAVEDAD[rightData.peorGravedad as GravedadKey]?.color || "#555",
                    boxShadow: winner === "right" ? `0 0 30px ${GRAVEDAD[rightData.peorGravedad as GravedadKey]?.color}40` : "none",
                  }}
                >
                  <VersusPhoto slug={right} nombre={rightData.nombre} side="right" />
                </div>
                <h3 className="text-base font-black text-white line-clamp-2 min-h-[2.5rem] flex items-center justify-center px-2">{rightData.nombre}</h3>
                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 px-2">{rightData.partido}</p>
                <div className="flex items-center gap-2 mt-2">
                  <GravedadBadge gravedad={rightData.peorGravedad} />
                  <span className="text-xs text-gray-500">{rightData.totalNoticias} noticias</span>
                </div>
              </div>
            </div>

            {/* Desktop: Cambiar candidatos */}
            <div className="hidden md:grid mb-8 md:grid-cols-[1fr_auto_1fr] gap-6 items-end">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Cambiar candidato 1</label>
                <SearchableSelect
                  value={left}
                  onChange={setLeft}
                  options={lista}
                  disabledValue={right}
                  placeholder="Seleccionar candidato..."
                  accentColor="red"
                />
              </div>
              <div className="flex flex-col items-center justify-center py-4">
                <span className="text-4xl font-black text-red-500 italic" style={{ textShadow: "0 0 20px rgba(220,38,38,0.5)" }}>
                  VS
                </span>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Cambiar candidato 2</label>
                <SearchableSelect
                  value={right}
                  onChange={setRight}
                  options={lista}
                  disabledValue={left}
                  placeholder="Seleccionar candidato..."
                  accentColor="blue"
                />
              </div>
            </div>

            {/* Botón ver veredicto */}
            {showResults && winnerData && (
              <div className="mb-8 text-center animate-fade-in">
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-200 hover:scale-[1.03]"
                  style={{
                    backgroundColor: `${GRAVEDAD[winnerData.peorGravedad as GravedadKey]?.color || "#dc2626"}20`,
                    color: GRAVEDAD[winnerData.peorGravedad as GravedadKey]?.color || "#dc2626",
                    border: `1px solid ${GRAVEDAD[winnerData.peorGravedad as GravedadKey]?.color || "#dc2626"}40`,
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Ver veredicto
                </button>
              </div>
            )}

            {/* Desglose por gravedad */}
            {showResults && (
              <div className="mb-8 rounded-2xl border border-gray-800/60 bg-gray-900/40 backdrop-blur-sm p-4 sm:p-8 animate-fade-in">
                <h3 className="text-center text-sm font-bold uppercase tracking-wider text-white mb-2">
                  Desglose por gravedad
                </h3>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 items-center text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">
                  <span className="truncate text-left">{leftData.nombre.split(" ").slice(0, 2).join(" ")}</span>
                  <span />
                  <span className="truncate text-right">{rightData.nombre.split(" ").slice(0, 2).join(" ")}</span>
                </div>
                {(["MUY_PELIGROSO", "PELIGROSO", "MODERADO", "LEVE", "LIMPIO"] as GravedadKey[]).map((g) => {
                  const lCount = leftData.gravedadCounts[g] || 0;
                  const rCount = rightData.gravedadCounts[g] || 0;
                  const max = Math.max(lCount, rCount, 1);

                  return (
                    <div key={g} className="mb-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2 items-center text-xs mb-1">
                        <span className="font-bold text-white text-left">{lCount}</span>
                        <span className="text-center font-semibold" style={{ color: GRAVEDAD[g].color }}>
                          {GRAVEDAD[g].label}
                        </span>
                        <span className="font-bold text-white text-right">{rCount}</span>
                      </div>
                      <div className="flex gap-1 h-3">
                        <div className="flex-1 flex justify-end">
                          <div
                            className="h-full rounded-l-full transition-all duration-1000"
                            style={{
                              width: `${(lCount / max) * 100}%`,
                              backgroundColor: GRAVEDAD[g].color,
                              minWidth: lCount > 0 ? "4px" : "0",
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <div
                            className="h-full rounded-r-full transition-all duration-1000"
                            style={{
                              width: `${(rCount / max) * 100}%`,
                              backgroundColor: GRAVEDAD[g].color,
                              minWidth: rCount > 0 ? "4px" : "0",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Propuestas oficiales */}
            {showResults && eleccion === "municipal-2026" && (
              <section className="mb-8 animate-fade-in">
                <div className="mb-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">
                    Fuente oficial JNE
                  </p>
                  <h3 className="mt-1 text-sm font-bold uppercase tracking-wider text-white">
                    Propuestas y planes de gobierno
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {[
                    { data: leftData, plan: leftPlan, color: "text-red-400" },
                    { data: rightData, plan: rightPlan, color: "text-blue-400" },
                  ].map(({ data, plan, color }) => (
                    <div key={data.slug} className="min-w-0 rounded-2xl border border-gray-800/70 bg-gray-950/60 p-4">
                      <div className="mb-4 flex items-end justify-between gap-2 border-b border-gray-800/60 pb-3">
                        <h4 className={`text-sm font-black ${color}`}>{data.nombre}</h4>
                        <span className="shrink-0 text-[10px] font-bold text-gray-500">
                          {plan?.propuestas.length ?? 0} propuestas
                        </span>
                      </div>
                      {plan ? (
                        <PlanGobierno plan={plan} compact />
                      ) : (
                        <p className="rounded-xl border border-dashed border-gray-700/60 p-6 text-center text-xs text-gray-500">
                          No se encontró un resumen oficial del plan en el JNE.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Top 5 noticias */}
            {showResults && (
              <div className="animate-fade-in">
                <h3 className="text-center text-sm font-bold uppercase tracking-wider text-white mb-6">
                  Top 5 noticias más graves
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { data: leftData, noticias: leftNoticias, slug: left, color: "red" },
                    { data: rightData, noticias: rightNoticias, slug: right, color: "blue" },
                  ].map(({ data, noticias, slug, color }) => (
                    <div key={slug}>
                      <h4 className={`text-sm font-bold uppercase tracking-wider text-${color}-500 mb-3 border-b border-${color}-500/30 pb-2`}>
                        {data.nombre}
                      </h4>
                      {noticias.length > 0 ? (
                        <div className="space-y-2">
                          {noticias.slice(0, 5).map((n, i) => (
                            <a
                              key={n.id}
                              href={n.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-lg border border-gray-700 bg-gray-900 p-3 hover:border-gray-500 transition-colors"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold text-gray-500">#{i + 1}</span>
                                <GravedadBadge gravedad={n.gravedad} />
                                <span className="text-[10px] text-gray-500">{TIPO_LABELS[n.tipo] || n.tipo}</span>
                                <span className="text-[10px] text-gray-600">{n.fuente}</span>
                                {n.fechaNoticia && (
                                  <span className="text-[10px] text-gray-600">{formatFecha(n.fechaNoticia)}</span>
                                )}
                              </div>
                              <p className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                                {n.titulo}
                              </p>
                            </a>
                          ))}
                          <a
                            href={`${eleccion === "municipal-2026" ? "/alcaldes" : "/candidato"}/${slug}`}
                            className="block text-center py-3 rounded-lg border border-dashed border-gray-600 text-sm font-semibold text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
                          >
                            Ver todas las noticias &rarr;
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">Sin noticias relevantes</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botón cambiar arriba (solo desktop, en mobile los selectores ya están visibles) */}
            <div className="mt-10 text-center hidden md:block">
              <button
                onClick={() => resultsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="px-8 py-3.5 border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 hover:bg-white/5 rounded-xl font-semibold transition-all duration-200"
              >
                Cambiar candidatos
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes dotWaveAnim {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
              30% { transform: translateY(-12px); opacity: 1; }
            }
          `}} />
          <div className="flex flex-col items-center gap-4">
            <p className="text-white font-bold text-sm uppercase tracking-wider">Comparando</p>
            <div className="flex gap-3">
              <span className="block w-4 h-4 bg-white rounded-full" style={{ animation: "dotWaveAnim 1.2s ease-in-out infinite" }} />
              <span className="block w-4 h-4 bg-white rounded-full" style={{ animation: "dotWaveAnim 1.2s ease-in-out 0.15s infinite" }} />
              <span className="block w-4 h-4 bg-white rounded-full" style={{ animation: "dotWaveAnim 1.2s ease-in-out 0.3s infinite" }} />
            </div>
          </div>
        </div>
      )}

      {/* Winner Modal */}
      {showModal && winnerData && loserData && (
        <WinnerModal
          winner={winnerData}
          loser={loserData}
          topNoticias={winnerNoticias}
          basePath={eleccion === "municipal-2026" ? "/alcaldes" : "/candidato"}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
