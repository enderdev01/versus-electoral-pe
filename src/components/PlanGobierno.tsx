import type { PlanGobiernoView } from "@/lib/planes-gobierno";

const DIMENSIONES = [
  { id: "SOCIAL", label: "Dimensión social", color: "text-sky-400", border: "border-sky-500/25" },
  { id: "ECONOMICA", label: "Dimensión económica", color: "text-amber-400", border: "border-amber-500/25" },
  { id: "AMBIENTAL", label: "Dimensión ambiental", color: "text-emerald-400", border: "border-emerald-500/25" },
  { id: "INSTITUCIONAL", label: "Dimensión institucional", color: "text-violet-400", border: "border-violet-500/25" },
] as const;

export function PlanGobierno({
  plan,
  compact = false,
  initialDimension,
}: {
  plan: PlanGobiernoView;
  compact?: boolean;
  initialDimension?: string;
}) {
  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {DIMENSIONES.map((dimension) => {
        const propuestas = plan.propuestas.filter((p) => p.dimension === dimension.id);
        if (propuestas.length === 0) return null;

        return (
          <details
            key={dimension.id}
            open={dimension.id === initialDimension ? true : undefined}
            className={`group rounded-xl border ${dimension.border} bg-gray-900/30`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3">
              <h3 className={`text-xs font-black uppercase tracking-[0.12em] ${dimension.color}`}>
                {dimension.label}
              </h3>
              <span className="flex shrink-0 items-center gap-2 text-[11px] font-bold text-gray-400">
                {propuestas.length} propuestas
                <span className="text-base transition-transform group-open:rotate-45">+</span>
              </span>
            </summary>
            <div className="space-y-2.5 border-t border-gray-800/70 p-2.5 sm:p-3">
              {propuestas.map((propuesta) => (
                <article
                  key={propuesta.jneId}
                  className={`rounded-xl border ${dimension.border} bg-gray-900/55 ${compact ? "p-3" : "p-4"}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Problema identificado
                  </p>
                  <p className={`${compact ? "text-xs" : "text-sm"} mt-1 text-gray-300`}>
                    {propuesta.problema}
                  </p>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Propuesta / objetivo
                  </p>
                  <p className={`${compact ? "text-xs" : "text-sm"} mt-1 font-semibold text-white`}>
                    {propuesta.objetivo}
                  </p>
                  {propuesta.meta && (
                    <div className="mt-3 rounded-lg bg-white/[0.035] px-3 py-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Meta</p>
                      <p className={`${compact ? "text-[11px]" : "text-xs"} mt-1 text-gray-300`}>
                        {propuesta.meta}
                      </p>
                    </div>
                  )}
                  {propuesta.indicador && (
                    <p className={`${compact ? "text-[10px]" : "text-xs"} mt-2 text-gray-500`}>
                      <strong className="text-gray-400">Indicador:</strong> {propuesta.indicador}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </details>
        );
      })}

      {plan.propuestas.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-700/60 p-6 text-center text-sm text-gray-500">
          El JNE registra el plan, pero todavía no publica propuestas en su resumen estructurado.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-gray-800/70 pt-3 text-[11px]">
        <span className="text-gray-500">Fuente oficial: JNE · expediente {plan.expediente}</span>
        <a
          href={`https://plataformahistorico.jne.gob.pe/Candidato/GetPlanGobiernoById/${plan.jneId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-red-400 hover:text-red-300"
        >
          Ver datos oficiales ↗
        </a>
        <a
          href={plan.fuenteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-gray-400 hover:text-white"
        >
          Plataforma Electoral ↗
        </a>
      </div>
    </div>
  );
}
