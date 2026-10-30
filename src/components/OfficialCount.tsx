"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { pct, ResultRows } from "@/components/ExitPollResults";
import type { ConteoAmbitoView, ConteoOficialView } from "@/lib/conteo-oficial";

const PARAM = "distrito";

export function OfficialCount({ conteo: inicial }: { conteo: ConteoOficialView }) {
  const selectId = useId();

  // The count is final: render the snapshot committed with the deploy, no polling.
  const conteo = inicial;

  const [slug, setSlug] = useState(inicial.ambitos[0].slug);

  // The home page is statically cached, so ?distrito= is read after mount
  // instead of through searchParams, which would make the page dynamic.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
    if (fromUrl && inicial.ambitos.some((a) => a.slug === fromUrl)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlug(fromUrl);
    }
  }, [inicial.ambitos]);

  const select = (next: string) => {
    setSlug(next);
    const url = new URL(window.location.href);
    if (next === conteo.ambitos[0].slug) url.searchParams.delete(PARAM);
    else url.searchParams.set(PARAM, next);
    window.history.replaceState(null, "", url);
  };

  const ambito = conteo.ambitos.find((a) => a.slug === slug) ?? conteo.ambitos[0];
  const actualizado = conteo.actualizado;

  return (
    <section
      aria-labelledby="official-count-title"
      className="mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-red-500/30 bg-gray-900/40 p-4 text-left backdrop-blur-sm sm:mt-8 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.3em] text-red-500">
          {ambito.actasPct !== null && ambito.actasPct < 100 && (
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-red-500" />
            </span>
          )}
          Conteo oficial ONPE
        </p>
        <div>
          <label htmlFor={selectId} className="sr-only">
            Elige la alcaldía
          </label>
          <select
            id={selectId}
            value={ambito.slug}
            onChange={(e) => select(e.target.value)}
            className="min-h-10 max-w-[16rem] rounded-full border border-gray-700 bg-gray-950 px-4 text-sm font-bold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            {conteo.ambitos.map((a, i) => (
              <option key={a.slug} value={a.slug}>
                {i === 0 ? a.nombre : `${a.nombre}${a.actasPct === null ? " (pendiente)" : ""}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ActasProgress ambito={ambito} />

      {ambito.filas.length > 0 ? (
        <ResultRows filas={ambito.filas} />
      ) : (
        <p className="mt-4 rounded-xl bg-gray-950/50 px-4 py-6 text-center text-sm text-gray-400">
          Estamos cargando el conteo de {ambito.nombre}. Vuelve en unos minutos.
        </p>
      )}

      <p className="mt-4 border-t border-gray-800 pt-3 text-[11px] leading-relaxed text-gray-500">
        Fuente: ONPE, resultados de actas contabilizadas
        {actualizado ? ` · Actualizado ${actualizado.replace(/\.$/, "")}` : ""}. Porcentajes sobre
        votos válidos.{" "}
        <a
          href="https://resultadoelectoral.onpe.gob.pe"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-gray-300"
        >
          Ver en la ONPE
        </a>
      </p>
    </section>
  );
}

const numero = (n: number) => n.toLocaleString("es-PE");

/** Share of actas counted, with counted, remaining and total actas when ONPE provides them. */
function ActasProgress({ ambito }: { ambito: ConteoAmbitoView }) {
  if (ambito.actasPct === null) {
    return (
      <h2 id="official-count-title" className="mt-3 text-sm font-semibold text-gray-300">
        {ambito.nombre}: aún sin actas contabilizadas
      </h2>
    );
  }
  const { actas } = ambito;
  return (
    <div className="mt-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="official-count-title" className="text-sm font-semibold text-gray-300">
          {ambito.nombre}
        </h2>
        <p className="text-right">
          <span className="text-2xl font-black tabular-nums text-white sm:text-3xl">{pct(ambito.actasPct)}</span>
          <span className="ml-1.5 text-xs font-semibold text-gray-400">actas contadas</span>
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Actas contabilizadas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ambito.actasPct}
        className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800"
      >
        <div
          className="h-full origin-left scale-x-(--share) rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-[scale] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] starting:scale-x-0 motion-reduce:transition-none"
          style={{ "--share": Math.min(ambito.actasPct, 100) / 100 } as CSSProperties}
        />
      </div>
      {actas && (
        <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            ["Contadas", actas.contabilizadas],
            ["Restantes", Math.max(actas.total - actas.contabilizadas, 0)],
            ["Total", actas.total],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-gray-950/50 px-2 py-1.5">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</dt>
              <dd className="text-sm font-bold tabular-nums text-white">{numero(value as number)}</dd>
            </div>
          ))}
        </dl>
      )}
      {ambito.votosValidos !== null && (
        <p className="mt-2 text-xs text-gray-500">{numero(ambito.votosValidos)} votos válidos contados</p>
      )}
    </div>
  );
}
