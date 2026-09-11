"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MunicipalComparison } from "./MunicipalComparison";
import { MunicipalEntry } from "./MunicipalEntry";
import type { MunicipalEntryOption, MunicipalPriority } from "@/lib/municipal-entry";

export interface VersusMunicipalProps {
  ambito: string;
  municipalityName: string;
  rosterSlugs: string[];
  options: MunicipalEntryOption[];
  priority?: MunicipalPriority;
  notice?: string;
}

/**
 * Keeps the municipal flow independent from the presidential VersusSelector.
 * The server has already validated the URL selection before this client boundary.
 */
export function VersusMunicipal({
  ambito,
  municipalityName,
  rosterSlugs,
  options,
  priority,
  notice,
}: VersusMunicipalProps) {
  const router = useRouter();
  const [isChangingSelection, setIsChangingSelection] = useState(false);
  const [normalizationNotice] = useState(notice);

  useEffect(() => {
    if (!notice) return;
    const params = new URLSearchParams({ ambito });
    if (priority) params.set("prioridad", priority);
    router.replace(`/alcaldes/versus?${params.toString()}`);
  }, [ambito, notice, priority, router]);

  if (isChangingSelection) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8">
        <MunicipalEntry
          autoFocus
          initialAmbito={ambito}
          initialPriority={priority}
          options={options}
          resetHref="/alcaldes/versus"
        />
      </section>
    );
  }

  return (
    <>
      <section className="border-b border-gray-800/70 bg-gray-950 px-4 py-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">Municipalidad seleccionada: {municipalityName}</p>
            {normalizationNotice ? <p role="status" className="mt-1 text-sm text-amber-200">{normalizationNotice}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setIsChangingSelection(true)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-gray-600 px-4 py-2 text-sm font-bold text-gray-100 hover:border-gray-400 hover:bg-gray-900"
          >
            Cambiar municipalidad
          </button>
        </div>
      </section>
      <MunicipalComparison
        key={ambito}
        ambito={ambito}
        rosterSlugs={rosterSlugs}
        municipalityName={municipalityName}
        priority={priority}
      />
    </>
  );
}
