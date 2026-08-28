import { revalidatePath } from "next/cache";
import { AMBITO_PROVINCIAL, CANDIDATO_MUNICIPAL_BY_SLUG } from "./municipales";

/**
 * Invalida solo las rutas de los candidatos que el scraping realmente tocó.
 *
 * Las páginas declaran un `revalidate` de un día como red de seguridad; esta
 * función es la que hace que un dato nuevo se vea al instante sin pagar una
 * escritura de ISR por ruta cada media hora.
 */
export function revalidarCandidatos(slugs: Iterable<string>): string[] {
  const rutas = new Set<string>();

  for (const slug of slugs) {
    const municipal = CANDIDATO_MUNICIPAL_BY_SLUG.get(slug);

    if (municipal) {
      rutas.add(`/alcaldes/${slug}`);
      rutas.add("/alcaldes");
      if (municipal.ambito && municipal.ambito !== AMBITO_PROVINCIAL) {
        rutas.add(`/alcaldes/distrito/${municipal.ambito}`);
      }
    } else {
      rutas.add(`/candidato/${slug}`);
      rutas.add("/candidato");
    }
  }

  // La portada resume ambas elecciones, así que cualquier cambio la afecta.
  if (rutas.size > 0) rutas.add("/");

  for (const ruta of rutas) {
    revalidatePath(ruta);
  }

  return [...rutas];
}
