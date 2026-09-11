import type { CandidatoData } from "./candidatos";
import type { MunicipalEntryOption } from "./municipal-entry";
import { CANDIDATOS_MUNICIPALES_DATA, CORTE_JNE } from "./municipales-data";

// ─────────────────────────────────────────────────────────────
// ELECCIONES MUNICIPALES 2026 · Lima Metropolitana + distritos
// ─────────────────────────────────────────────────────────────

/** Ámbito de una candidatura municipal: la provincial de Lima o un distrito. */
export const AMBITO_PROVINCIAL = "lima-metropolitana";

export interface Distrito {
  slug: string;
  nombre: string;
  /**
   * El Cercado no elige alcalde distrital: lo administra la Municipalidad
   * Metropolitana, así que sus votantes eligen la alcaldía provincial.
   */
  sinAlcaldiaPropia?: boolean;
}

/**
 * Los 43 distritos de la provincia de Lima. Solo 42 eligen alcalde distrital
 * (el Cercado se gobierna desde la Municipalidad Metropolitana).
 */
export const DISTRITOS_LIMA: Distrito[] = [
  { slug: "lima-cercado", nombre: "Lima (Cercado)", sinAlcaldiaPropia: true },
  { slug: "ancon", nombre: "Ancón" },
  { slug: "ate", nombre: "Ate" },
  { slug: "barranco", nombre: "Barranco" },
  { slug: "brena", nombre: "Breña" },
  { slug: "carabayllo", nombre: "Carabayllo" },
  { slug: "chaclacayo", nombre: "Chaclacayo" },
  { slug: "chorrillos", nombre: "Chorrillos" },
  { slug: "cieneguilla", nombre: "Cieneguilla" },
  { slug: "comas", nombre: "Comas" },
  { slug: "el-agustino", nombre: "El Agustino" },
  { slug: "independencia", nombre: "Independencia" },
  { slug: "jesus-maria", nombre: "Jesús María" },
  { slug: "la-molina", nombre: "La Molina" },
  { slug: "la-victoria", nombre: "La Victoria" },
  { slug: "lince", nombre: "Lince" },
  { slug: "los-olivos", nombre: "Los Olivos" },
  { slug: "lurigancho-chosica", nombre: "Lurigancho (Chosica)" },
  { slug: "lurin", nombre: "Lurín" },
  { slug: "magdalena-del-mar", nombre: "Magdalena del Mar" },
  { slug: "miraflores", nombre: "Miraflores" },
  { slug: "pachacamac", nombre: "Pachacámac" },
  { slug: "pucusana", nombre: "Pucusana" },
  { slug: "pueblo-libre", nombre: "Pueblo Libre" },
  { slug: "puente-piedra", nombre: "Puente Piedra" },
  { slug: "punta-hermosa", nombre: "Punta Hermosa" },
  { slug: "punta-negra", nombre: "Punta Negra" },
  { slug: "rimac", nombre: "Rímac" },
  { slug: "san-bartolo", nombre: "San Bartolo" },
  { slug: "san-borja", nombre: "San Borja" },
  { slug: "san-isidro", nombre: "San Isidro" },
  { slug: "san-juan-de-lurigancho", nombre: "San Juan de Lurigancho" },
  { slug: "san-juan-de-miraflores", nombre: "San Juan de Miraflores" },
  { slug: "san-luis", nombre: "San Luis" },
  { slug: "san-martin-de-porres", nombre: "San Martín de Porres" },
  { slug: "san-miguel", nombre: "San Miguel" },
  { slug: "santa-anita", nombre: "Santa Anita" },
  { slug: "santa-maria-del-mar", nombre: "Santa María del Mar" },
  { slug: "santa-rosa", nombre: "Santa Rosa" },
  { slug: "santiago-de-surco", nombre: "Santiago de Surco" },
  { slug: "surquillo", nombre: "Surquillo" },
  { slug: "villa-el-salvador", nombre: "Villa El Salvador" },
  { slug: "villa-maria-del-triunfo", nombre: "Villa María del Triunfo" },
];

export const DISTRITO_BY_SLUG = new Map(DISTRITOS_LIMA.map((d) => [d.slug, d]));

export interface CandidatoMunicipal extends CandidatoData {
  /** `lima-metropolitana` para la alcaldía provincial, o el slug del distrito. */
  ambito: string;
  /** Estado del postulante en el JNE: INSCRITO, ADMITIDO, RECIBIDO, etc. */
  estado: string;
  expediente: string;
  /** Id de la hoja de vida personal en la Plataforma Electoral del JNE. */
  hojaVidaId: number | null;
}

/**
 * Padrón municipal ERM 2026 (Lima), generado desde el export del JNE.
 * Ver scripts/generar-municipales.ts para regenerarlo cuando cambien los estados.
 */
export const CANDIDATOS_MUNICIPALES: CandidatoMunicipal[] = CANDIDATOS_MUNICIPALES_DATA;

export { CORTE_JNE };

export const CANDIDATO_MUNICIPAL_BY_SLUG = new Map(
  CANDIDATOS_MUNICIPALES.map((c) => [c.slug, c])
);

export function candidatosPorAmbito(ambito: string): CandidatoMunicipal[] {
  return CANDIDATOS_MUNICIPALES.filter((c) => c.ambito === ambito);
}

/** Cuántos postulantes tiene cada ámbito, según el padrón del JNE. */
export const POSTULANTES_POR_AMBITO: Map<string, number> = CANDIDATOS_MUNICIPALES.reduce(
  (acc, c) => acc.set(c.ambito, (acc.get(c.ambito) ?? 0) + 1),
  new Map<string, number>()
);

/** Distritos que ya tienen al menos una candidatura cargada. */
export function distritosConCandidatos(): Distrito[] {
  return DISTRITOS_LIMA.filter((d) => POSTULANTES_POR_AMBITO.has(d.slug));
}

/** Opciones públicas del flujo municipal, incluido el caso especial del Cercado. */
export function obtenerOpcionesMunicipales(): MunicipalEntryOption[] {
  const provincialTotal = POSTULANTES_POR_AMBITO.get(AMBITO_PROVINCIAL) ?? 0;
  return [
    {
      slug: AMBITO_PROVINCIAL,
      nombre: "Lima Metropolitana",
      total: provincialTotal,
      description: "Alcaldía provincial de Lima",
    },
    ...DISTRITOS_LIMA.map((distrito) => ({
      slug: distrito.slug,
      nombre: distrito.nombre,
      total: distrito.sinAlcaldiaPropia
        ? provincialTotal
        : (POSTULANTES_POR_AMBITO.get(distrito.slug) ?? 0),
      description: distrito.sinAlcaldiaPropia
        ? "El Cercado vota por la Alcaldía de Lima Metropolitana"
        : undefined,
    })),
  ];
}
