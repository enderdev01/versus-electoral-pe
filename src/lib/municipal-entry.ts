export const MUNICIPAL_PRIORITIES = [
  { value: "SOCIAL", slug: "social", label: "Dimensión social" },
  { value: "ECONOMICA", slug: "economica", label: "Dimensión económica" },
  { value: "AMBIENTAL", slug: "ambiental", label: "Dimensión ambiental" },
  { value: "INSTITUCIONAL", slug: "institucional", label: "Dimensión institucional" },
] as const;

export type MunicipalPriority = (typeof MUNICIPAL_PRIORITIES)[number]["value"];

export interface MunicipalEntryOption {
  slug: string;
  nombre: string;
  total: number;
  description?: string;
}

export interface MunicipalEntrySelection {
  ambito: string;
  prioridad?: MunicipalPriority;
}

export type MunicipalComparisonQueryResult =
  | { status: "needs-selection" }
  | { status: "invalid"; message: string; requestedAmbito?: string }
  | {
      status: "valid";
      requestedAmbito: string;
      ambito: string;
      prioridad?: MunicipalPriority;
      notice?: string;
    };

const PRIORITY_BY_SLUG = new Map<string, MunicipalPriority>(
  MUNICIPAL_PRIORITIES.map((priority) => [priority.slug, priority.value]),
);
const PRIORITY_BY_VALUE = new Set<MunicipalPriority>(
  MUNICIPAL_PRIORITIES.map((priority) => priority.value),
);

export function buildMunicipalComparisonUrl(
  selection: MunicipalEntrySelection | undefined,
  validAmbitos: ReadonlySet<string>,
): string {
  if (!selection) return "/alcaldes/versus";

  if (
    typeof selection !== "object" ||
    selection === null ||
    typeof selection.ambito !== "string" ||
    !selection.ambito ||
    !validAmbitos.has(selection.ambito)
  ) {
    throw new Error("La municipalidad seleccionada no es válida.");
  }

  const ambito = normalizeAmbito(selection.ambito);
  if (!validAmbitos.has(ambito)) {
    throw new Error("La municipalidad seleccionada no es válida.");
  }
  const query = new URLSearchParams({ ambito });
  if (selection.prioridad !== undefined) {
    if (!PRIORITY_BY_VALUE.has(selection.prioridad)) {
      throw new Error("La prioridad seleccionada no es válida.");
    }
    query.set("prioridad", selection.prioridad);
  }
  return `/alcaldes/versus?${query.toString()}`;
}

function normalizeAmbito(ambito: string): string {
  return ambito === "lima-cercado" ? "lima-metropolitana" : ambito;
}

function parsePriority(value: string): MunicipalPriority | undefined {
  return (
    (PRIORITY_BY_VALUE.has(value as MunicipalPriority)
      ? (value as MunicipalPriority)
      : undefined) ?? PRIORITY_BY_SLUG.get(value)
  );
}

export function parseMunicipalComparisonQuery(
  query: { ambito?: string | string[]; prioridad?: string | string[] },
  validAmbitos: ReadonlySet<string>,
): MunicipalComparisonQueryResult {
  if (query.ambito === undefined && query.prioridad === undefined) {
    return { status: "needs-selection" };
  }
  if (
    typeof query.ambito !== "string" ||
    !query.ambito ||
    !validAmbitos.has(query.ambito)
  ) {
    return {
      status: "invalid",
      message: "El distrito indicado en el enlace no es válido.",
    };
  }

  const requestedAmbito = query.ambito;
  let prioridad: MunicipalPriority | undefined;
  if (query.prioridad !== undefined) {
    prioridad =
      typeof query.prioridad === "string"
        ? parsePriority(query.prioridad)
        : undefined;
    if (!prioridad) {
      return {
        status: "invalid",
        message: "La prioridad indicada en el enlace no es válida.",
        requestedAmbito,
      };
    }
  }

  if (requestedAmbito === "lima-cercado") {
    const result: Extract<MunicipalComparisonQueryResult, { status: "valid" }> = {
      status: "valid",
      requestedAmbito,
      ambito: "lima-metropolitana",
      notice:
        "Lima (Cercado) no elige una alcaldía distrital: corresponde comparar la Alcaldía de Lima Metropolitana.",
    };
    if (prioridad) result.prioridad = prioridad;
    return result;
  }

  const result: Extract<MunicipalComparisonQueryResult, { status: "valid" }> = {
    status: "valid",
    requestedAmbito,
    ambito: requestedAmbito,
  };
  if (prioridad) result.prioridad = prioridad;
  return result;
}
