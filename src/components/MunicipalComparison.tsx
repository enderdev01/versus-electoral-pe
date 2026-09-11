"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { PlanGobierno } from "./PlanGobierno";
import type { PlanGobiernoView } from "@/lib/planes-gobierno";

export interface MunicipalCandidate {
  id: number;
  nombre: string;
  partido: string;
  slug: string;
}

export type MunicipalPriority = "SOCIAL" | "ECONOMICA" | "AMBIENTAL" | "INSTITUCIONAL";

export interface MunicipalNews {
  id: number;
  titulo: string;
  fuente: string;
  url: string;
  fechaNoticia: string | null;
}

export type SourceState<T> =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; data: T };

export interface ComparisonResults {
  plans: { left: SourceState<PlanGobiernoView>; right: SourceState<PlanGobiernoView> };
  news: { left: SourceState<MunicipalNews[]>; right: SourceState<MunicipalNews[]> };
}

function isPlanGobierno(value: unknown): value is PlanGobiernoView {
  if (typeof value !== "object" || value === null) return false;
  const plan = value as Record<string, unknown>;
  return typeof plan.jneId === "number" && typeof plan.expediente === "string" && Array.isArray(plan.propuestas);
}

function isMunicipalNews(value: unknown): value is MunicipalNews {
  if (typeof value !== "object" || value === null) return false;
  const news = value as Record<string, unknown>;
  return typeof news.id === "number" && typeof news.titulo === "string" && typeof news.fuente === "string"
    && typeof news.url === "string" && (typeof news.fechaNoticia === "string" || news.fechaNoticia === null);
}

export function resolvePlanResponse(response: { ok: boolean; body: unknown }): SourceState<PlanGobiernoView> {
  if (!response.ok || typeof response.body !== "object" || response.body === null) return { status: "unavailable" };
  const plan = (response.body as { plan?: unknown }).plan;
  return isPlanGobierno(plan) ? { status: "ready", data: plan } : { status: "unavailable" };
}

export function resolveNewsResponse(response: { ok: boolean; body: unknown }): SourceState<MunicipalNews[]> {
  if (!response.ok || typeof response.body !== "object" || response.body === null) return { status: "unavailable" };
  const news = (response.body as { noticias?: unknown }).noticias;
  return Array.isArray(news) && news.every(isMunicipalNews)
    ? { status: "ready", data: news.toSorted((left, right) => (left.fechaNoticia ?? "").localeCompare(right.fechaNoticia ?? "")) }
    : { status: "unavailable" };
}

export type EligibilityState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "ready"; candidates: MunicipalCandidate[] };

export function isMunicipalCandidate(value: unknown): value is MunicipalCandidate {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.nombre === "string" &&
    typeof candidate.partido === "string" &&
    typeof candidate.slug === "string"
  );
}

export function resolveEligibility(
  rosterSlugs: readonly string[],
  response: unknown,
): EligibilityState {
  if (rosterSlugs.length === 0) return { status: "empty" };
  if (!Array.isArray(response) || !response.every(isMunicipalCandidate)) {
    return { status: "error" };
  }

  const allowed = new Set(rosterSlugs);
  const candidates = response
    .filter((candidate) => allowed.has(candidate.slug))
    .toSorted((left, right) => left.nombre.localeCompare(right.nombre, "es-PE"));

  return candidates.length > 0
    ? { status: "ready", candidates }
    : { status: "unavailable" };
}

export function resolveEligibilityResponse(
  rosterSlugs: readonly string[],
  response: { ok: boolean; body: unknown },
): EligibilityState {
  return response.ok
    ? resolveEligibility(rosterSlugs, response.body)
    : { status: "error" };
}

export function createRequestGeneration() {
  let current = 0;
  return {
    next: () => ++current,
    isCurrent: (generation: number) => generation === current,
  };
}

export function rosterContentKey(rosterSlugs: readonly string[]): string {
  return JSON.stringify(rosterSlugs);
}

export interface MunicipalComparisonProps {
  ambito: string;
  rosterSlugs: readonly string[];
  municipalityName: string;
  priority?: MunicipalPriority;
}

interface ViewState {
  eligibility: EligibilityState;
  left: string;
  right: string;
  retry: number;
  results: ComparisonResults | null;
}

type ViewAction =
  | { type: "scope"; eligibility: EligibilityState }
  | { type: "eligibility"; eligibility: EligibilityState }
  | { type: "retry" }
  | { type: "left"; value: string }
  | { type: "right"; value: string }
  | { type: "results"; results: ComparisonResults }
  | { type: "plans"; plans: ComparisonResults["plans"] }
  | { type: "news"; news: ComparisonResults["news"] };

function loadingResults(): ComparisonResults {
  return {
    plans: { left: { status: "loading" }, right: { status: "loading" } },
    news: { left: { status: "loading" }, right: { status: "loading" } },
  };
}

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case "scope":
      return { ...state, eligibility: action.eligibility, left: "", right: "", results: null };
    case "eligibility":
      return { ...state, eligibility: action.eligibility };
    case "retry":
      return { ...state, retry: state.retry + 1 };
    case "left":
      return { ...state, left: action.value, right: action.value === state.right ? "" : state.right, results: null };
    case "right":
      return { ...state, right: action.value, left: action.value === state.left ? "" : state.left, results: null };
    case "results":
      return { ...state, results: action.results };
    case "plans":
      return state.results ? { ...state, results: { ...state.results, plans: action.plans } } : state;
    case "news":
      return state.results ? { ...state, results: { ...state.results, news: action.news } } : state;
  }
}

export function MunicipalComparison({
  ambito,
  rosterSlugs,
  municipalityName,
  priority,
}: MunicipalComparisonProps) {
  const rosterKey = rosterContentKey(rosterSlugs);
  const stableRoster = useMemo(
    () => JSON.parse(rosterKey) as string[],
    [rosterKey],
  );
  const generations = useRef(createRequestGeneration());
  const controller = useRef<AbortController | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resultGenerations = useRef(createRequestGeneration());
  const [view, dispatch] = useReducer(viewReducer, {
    eligibility: rosterSlugs.length === 0 ? { status: "empty" } : { status: "loading" },
    left: "",
    right: "",
    retry: 0,
    results: null,
  });

  useEffect(() => {
    headingRef.current?.focus();
  }, [ambito]);

  useEffect(() => {
    const generation = generations.current.next();
    controller.current?.abort();

    if (stableRoster.length === 0) {
      dispatch({ type: "scope", eligibility: { status: "empty" } });
      return;
    }

    const request = new AbortController();
    controller.current = request;
    dispatch({ type: "scope", eligibility: { status: "loading" } });
    const query = new URLSearchParams({ eleccion: "municipal-2026", ambito });

    fetch(`/api/candidatos?${query}`, { signal: request.signal })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }))
      .then((response) => {
        if (!generations.current.isCurrent(generation)) return;
        dispatch({ type: "eligibility", eligibility: resolveEligibilityResponse(stableRoster, response) });
      })
      .catch(() => {
        if (request.signal.aborted || !generations.current.isCurrent(generation)) return;
        dispatch({ type: "eligibility", eligibility: { status: "error" } });
      });

    return () => request.abort();
  }, [ambito, stableRoster, view.retry]);

  const candidates = useMemo(
    () => (view.eligibility.status === "ready" ? view.eligibility.candidates : []),
    [view.eligibility],
  );
  const selectedLeft = useMemo(
    () => candidates.find((candidate) => candidate.slug === view.left),
    [candidates, view.left],
  );
  const selectedRight = useMemo(
    () => candidates.find((candidate) => candidate.slug === view.right),
    [candidates, view.right],
  );
  const leftSlug = selectedLeft?.slug;
  const rightSlug = selectedRight?.slug;

  useEffect(() => {
    if (!leftSlug || !rightSlug) return;

    const generation = resultGenerations.current.next();
    const request = new AbortController();
    const getJson = (path: string) => fetch(path, { signal: request.signal })
      .then(async (response) => ({ ok: response.ok, body: await response.json() }));

    dispatch({ type: "results", results: loadingResults() });

    const loadPlan = (slug: string) => getJson(`/api/propuestas?candidato=${encodeURIComponent(slug)}`)
      .then(resolvePlanResponse)
      .catch((): SourceState<PlanGobiernoView> => ({ status: "unavailable" }));
    const loadNews = (slug: string) => getJson(`/api/noticias?candidato=${encodeURIComponent(slug)}&limit=3`)
      .then(resolveNewsResponse)
      .catch((): SourceState<MunicipalNews[]> => ({ status: "unavailable" }));

    void Promise.all([loadPlan(leftSlug), loadPlan(rightSlug)])
      .then(([left, right]) => {
        if (request.signal.aborted || !resultGenerations.current.isCurrent(generation)) return;
        dispatch({ type: "plans", plans: { left, right } });
      });

    void Promise.all([loadNews(leftSlug), loadNews(rightSlug)])
      .then(([left, right]) => {
        if (request.signal.aborted || !resultGenerations.current.isCurrent(generation)) return;
        dispatch({ type: "news", news: { left, right } });
      });

    return () => request.abort();
  }, [leftSlug, rightSlug]);

  return (
    <section aria-labelledby="municipal-comparison-title" className="px-4 py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-700/80 bg-gray-900/70 p-5 sm:p-7">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-400">
          Comparación municipal 2026
        </p>
        <h1 ref={headingRef} id="municipal-comparison-title" tabIndex={-1} className="mt-2 text-2xl font-black text-white sm:text-3xl">
          Candidaturas para {municipalityName}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">
          Elige dos candidaturas de la misma municipalidad para revisar su información oficial.
        </p>

        {view.eligibility.status === "loading" ? (
          <p role="status" className="mt-6 rounded-xl border border-gray-700 bg-gray-950/40 p-4 text-sm text-gray-300">
            Cargando candidaturas disponibles…
          </p>
        ) : null}

        {view.eligibility.status === "empty" ? (
          <p role="status" className="mt-6 rounded-xl border border-gray-700 bg-gray-950/40 p-4 text-sm text-gray-300">
            Aún no hay candidaturas elegibles registradas para esta municipalidad.
          </p>
        ) : null}

        {view.eligibility.status === "unavailable" ? (
          <RecoveryState onRetry={() => dispatch({ type: "retry" })} />
        ) : null}

        {view.eligibility.status === "error" ? <RecoveryState onRetry={() => dispatch({ type: "retry" })} error /> : null}

        {view.eligibility.status === "ready" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <CandidateSelect
              id="municipal-candidate-left"
              label="Candidatura 1"
              value={view.left}
              candidates={candidates}
              excluded={view.right}
              onChange={(value) => dispatch({ type: "left", value })}
            />
            <CandidateSelect
              id="municipal-candidate-right"
              label="Candidatura 2"
              value={view.right}
              candidates={candidates}
              excluded={view.left}
              onChange={(value) => dispatch({ type: "right", value })}
            />
            {selectedLeft && selectedRight ? (
              <div className="sm:col-span-2">
                {view.results ? (
                  <ComparisonPanels left={selectedLeft} right={selectedRight} priority={priority} results={view.results} />
                ) : (
                  <p className="rounded-xl border border-gray-700 bg-gray-950/40 p-4 text-sm text-gray-300">
                    Has elegido {selectedLeft.nombre} y {selectedRight.nombre}. La comparación de propuestas se cargará a continuación.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ComparisonPanels({
  left,
  right,
  priority,
  results,
}: {
  left: MunicipalCandidate;
  right: MunicipalCandidate;
  priority?: MunicipalPriority;
  results: ComparisonResults;
}) {
  return (
    <div className="mt-6 space-y-8">
      <section aria-labelledby="municipal-plans-title">
        <div className="mb-3">
          <h2 id="municipal-plans-title" className="text-lg font-black text-white">Propuestas oficiales</h2>
          <p className="mt-1 text-sm text-gray-400">Texto publicado en los registros del JNE, sin calificaciones ni recomendaciones.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <CandidatePlan candidate={left} source={results.plans.left} priority={priority} />
          <CandidatePlan candidate={right} source={results.plans.right} priority={priority} />
        </div>
      </section>

      <section aria-labelledby="municipal-news-title" className="border-t border-gray-700/70 pt-6">
        <div className="mb-3">
          <h2 id="municipal-news-title" className="text-base font-black text-white">Noticias relacionadas</h2>
          <p className="mt-1 text-xs text-gray-500">Contexto secundario, limitado a tres publicaciones por candidatura y ordenado por fecha.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <CandidateNews candidate={left} source={results.news.left} />
          <CandidateNews candidate={right} source={results.news.right} />
        </div>
      </section>
    </div>
  );
}

function CandidatePlan({
  candidate,
  source,
  priority,
}: {
  candidate: MunicipalCandidate;
  source: SourceState<PlanGobiernoView>;
  priority?: MunicipalPriority;
}) {
  return (
    <article className="rounded-xl border border-gray-700 bg-gray-950/40 p-4">
      <h3 className="font-bold text-white">{candidate.nombre}</h3>
      <p className="text-xs text-gray-400">{candidate.partido}</p>
      <div className="mt-4">
        {source.status === "loading" ? <p role="status" className="text-sm text-gray-400">Cargando plan oficial…</p> : null}
        {source.status === "ready" ? <PlanGobierno plan={source.data} compact initialDimension={priority} /> : null}
        {source.status === "unavailable" ? (
          <p className="rounded-lg border border-dashed border-gray-700 p-3 text-sm text-gray-400">
            El plan oficial no está disponible en el resumen consultado. {" "}
            <a className="font-bold text-red-400 hover:text-red-300" href="https://plataformahistorico.jne.gob.pe/" target="_blank" rel="noopener noreferrer">
              Consultar la fuente oficial del JNE ↗
            </a>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function CandidateNews({ candidate, source }: { candidate: MunicipalCandidate; source: SourceState<MunicipalNews[]> }) {
  return (
    <article className="rounded-xl border border-gray-800 bg-gray-950/30 p-4">
      <h3 className="font-bold text-white">{candidate.nombre}</h3>
      {source.status === "loading" ? <p role="status" className="mt-3 text-sm text-gray-500">Cargando contexto…</p> : null}
      {source.status === "unavailable" ? <p className="mt-3 text-sm text-gray-500">El contexto de noticias no está disponible por ahora.</p> : null}
      {source.status === "ready" && source.data.length === 0 ? <p className="mt-3 text-sm text-gray-500">No hay publicaciones disponibles para este contexto.</p> : null}
      {source.status === "ready" && source.data.length > 0 ? (
        <ol className="mt-3 space-y-2">
          {source.data.slice(0, 3).map((news) => (
            <li key={news.id} className="rounded-lg border border-gray-800/80 p-3 text-sm">
              <a href={news.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-200 hover:text-white">{news.titulo}</a>
              <p className="mt-1 text-xs text-gray-500">{news.fuente}{news.fechaNoticia ? ` · ${news.fechaNoticia}` : ""}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </article>
  );
}

export function CandidateSelect({
  id,
  label,
  value,
  candidates,
  excluded,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  candidates: MunicipalCandidate[];
  excluded: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-white">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-white">
        <option value="">Selecciona una candidatura</option>
        {candidates.map((candidate) => (
          <option key={candidate.slug} value={candidate.slug} disabled={candidate.slug === excluded}>
            {candidate.nombre} · {candidate.partido}
          </option>
        ))}
      </select>
    </div>
  );
}

function RecoveryState({ onRetry, error = false }: { onRetry: () => void; error?: boolean }) {
  return (
    <div role={error ? "alert" : "status"} className="mt-6 rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 text-sm text-amber-50">
      <p>{error ? "No pudimos cargar las candidaturas. Inténtalo nuevamente." : "El padrón tiene candidaturas, pero aún no están disponibles para comparar."}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={onRetry} className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-gray-950">Reintentar</button>
        <Link href="/alcaldes/versus" className="rounded-lg border border-amber-200/50 px-3 py-2 font-bold">Cambiar municipalidad</Link>
      </div>
    </div>
  );
}
