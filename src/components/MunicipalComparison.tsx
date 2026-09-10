"use client";

import Link from "next/link";
import { useEffect, useMemo, useReducer, useRef } from "react";

export interface MunicipalCandidate {
  id: number;
  nombre: string;
  partido: string;
  slug: string;
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
}

interface ViewState {
  eligibility: EligibilityState;
  left: string;
  right: string;
  retry: number;
}

type ViewAction =
  | { type: "scope"; eligibility: EligibilityState }
  | { type: "eligibility"; eligibility: EligibilityState }
  | { type: "retry" }
  | { type: "left"; value: string }
  | { type: "right"; value: string };

export function viewReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case "scope":
      return { ...state, eligibility: action.eligibility, left: "", right: "" };
    case "eligibility":
      return { ...state, eligibility: action.eligibility };
    case "retry":
      return { ...state, retry: state.retry + 1 };
    case "left":
      return { ...state, left: action.value, right: action.value === state.right ? "" : state.right };
    case "right":
      return { ...state, right: action.value, left: action.value === state.left ? "" : state.left };
  }
}

export function MunicipalComparison({
  ambito,
  rosterSlugs,
  municipalityName,
}: MunicipalComparisonProps) {
  const rosterKey = rosterContentKey(rosterSlugs);
  const stableRoster = useMemo(
    () => JSON.parse(rosterKey) as string[],
    [rosterKey],
  );
  const generations = useRef(createRequestGeneration());
  const controller = useRef<AbortController | null>(null);
  const [view, dispatch] = useReducer(viewReducer, {
    eligibility: rosterSlugs.length === 0 ? { status: "empty" } : { status: "loading" },
    left: "",
    right: "",
    retry: 0,
  });

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

  return (
    <section aria-labelledby="municipal-comparison-title" className="px-4 py-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-700/80 bg-gray-900/70 p-5 sm:p-7">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-400">
          Comparación municipal 2026
        </p>
        <h1 id="municipal-comparison-title" className="mt-2 text-2xl font-black text-white sm:text-3xl">
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
              <p className="sm:col-span-2 rounded-xl border border-gray-700 bg-gray-950/40 p-4 text-sm text-gray-300">
                Has elegido {selectedLeft.nombre} y {selectedRight.nombre}. La comparación de propuestas se cargará a continuación.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
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
