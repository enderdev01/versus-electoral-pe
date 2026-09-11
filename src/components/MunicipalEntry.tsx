"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import {
  buildMunicipalComparisonUrl,
  MUNICIPAL_PRIORITIES,
  type MunicipalEntryOption,
  type MunicipalEntrySelection,
  type MunicipalPriority,
} from "@/lib/municipal-entry";

export interface MunicipalEntryProps {
  options: MunicipalEntryOption[];
  initialAmbito?: string;
  initialPriority?: MunicipalPriority;
  error?: string;
  resetHref?: string;
  autoFocus?: boolean;
  onSubmit?: (selection: MunicipalEntrySelection) => void;
}

export function MunicipalEntry({
  options,
  initialAmbito = "",
  initialPriority,
  error,
  resetHref,
  autoFocus = false,
  onSubmit,
}: MunicipalEntryProps) {
  const router = useRouter();
  const ambitoRef = useRef<HTMLSelectElement>(null);
  const [ambito, setAmbito] = useState(initialAmbito);
  const [prioridad, setPrioridad] = useState<MunicipalPriority | undefined>(
    initialPriority,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selected = options.find((option) => option.slug === ambito);
  const validAmbitos = new Set(options.map((option) => option.slug));

  useEffect(() => {
    if (error || autoFocus) ambitoRef.current?.focus();
  }, [autoFocus, error]);

  function handleAmbitoChange(nextAmbito: string) {
    setAmbito(nextAmbito);
    setValidationError(null);
  }

  function handleReset() {
    setAmbito("");
    setPrioridad(undefined);
    setValidationError(null);
    if (resetHref) {
      router.push(resetHref);
      return;
    }
    ambitoRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setValidationError("Selecciona una municipalidad para continuar.");
      ambitoRef.current?.focus();
      return;
    }
    const selection = { ambito, prioridad };
    startTransition(() => {
      if (onSubmit) {
        onSubmit(selection);
        return;
      }
      router.push(buildMunicipalComparisonUrl(selection, validAmbitos));
    });
  }

  if (options.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-gray-700 bg-gray-900/40 p-5 text-center">
        <h2 className="text-lg font-black text-white">
          Encuentra y compara candidaturas de tu municipalidad
        </h2>
        <p className="mt-2 text-sm text-gray-300">
          Aún no hay municipalidades disponibles para iniciar la comparación.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="municipal-entry-title"
        className="rounded-2xl border border-gray-700/80 bg-gray-900/70 p-5 shadow-xl shadow-black/20 sm:p-7"
      >
      <div className="mb-6">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-400">
          Comparación municipal 2026
        </p>
        <h2
          id="municipal-entry-title"
          className="mt-2 text-xl font-black text-white sm:text-2xl"
        >
          Encuentra y compara candidaturas de tu municipalidad
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-300">
          Contrasta propuestas oficiales del JNE y noticias como contexto, sin calificar ni recomendar candidaturas.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-100"
        >
          {error} Elige una opción disponible para continuar.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
          <div className="min-w-0">
            <label
              htmlFor="municipal-entry-ambito"
              className="mb-2 block text-sm font-bold text-white"
            >
              1. Tu municipalidad
            </label>
            <select
              id="municipal-entry-ambito"
              ref={ambitoRef}
              value={ambito}
              onChange={(event) => handleAmbitoChange(event.target.value)}
              aria-describedby={validationError ? "municipal-entry-ambito-help municipal-entry-status" : "municipal-entry-ambito-help"}
              aria-invalid={validationError ? true : undefined}
              className="min-h-12 w-full min-w-0 rounded-xl border border-gray-600 bg-gray-950 px-3 py-3 text-base text-white focus:border-red-400"
            >
              <option value="">Selecciona tu municipalidad</option>
              {options.map((option) => (
                <option key={option.slug} value={option.slug}>
                  {option.nombre} · {option.total > 0 ? `${option.total} candidatos` : "sin candidaturas"}
                </option>
              ))}
            </select>
            <p
              id="municipal-entry-ambito-help"
              className="mt-2 text-xs leading-relaxed text-gray-400"
            >
              {selected?.description ??
                "Solo compararemos candidaturas de la misma municipalidad."}
            </p>
          </div>

          <fieldset className="min-w-0">
            <legend className="text-sm font-bold text-white">
              2. Prioridad del plan (opcional)
            </legend>
            <p className="mt-1 text-xs text-gray-400">
              Puedes cambiarla o ver todas las dimensiones; no guardamos tu elección.
            </p>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gray-700 bg-gray-950/70 px-3 py-2.5 text-sm text-gray-200 has-[:checked]:border-red-500 has-[:checked]:bg-red-950/30">
                <input
                  type="radio"
                  name="prioridad"
                  checked={prioridad === undefined}
                  onChange={() => setPrioridad(undefined)}
                  className="h-4 w-4 shrink-0 accent-red-500"
                />
                Todas
              </label>
              {MUNICIPAL_PRIORITIES.map((option) => (
                <label
                  key={option.value}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-gray-700 bg-gray-950/70 px-3 py-2.5 text-sm text-gray-200 has-[:checked]:border-red-500 has-[:checked]:bg-red-950/30"
                >
                  <input
                    type="radio"
                    name="prioridad"
                    value={option.value}
                    checked={prioridad === option.value}
                    onChange={() => setPrioridad(option.value)}
                    className="h-4 w-4 shrink-0 accent-red-500"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-600 px-6 py-3 text-sm font-black text-white transition hover:bg-red-500 disabled:cursor-wait disabled:bg-gray-700"
          >
            {isPending ? "Abriendo comparación…" : "Ver y comparar candidaturas"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!ambito && !prioridad}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-300 underline-offset-4 hover:text-white hover:underline disabled:cursor-not-allowed disabled:text-gray-500"
          >
            Limpiar selección
          </button>
        </div>
        <p id="municipal-entry-status" aria-live="polite" className="mt-3 min-h-5 text-sm font-semibold text-amber-300">
          {validationError ?? (isPending ? "Cargando la municipalidad seleccionada." : "")}
        </p>
      </form>
    </section>
  );
}
