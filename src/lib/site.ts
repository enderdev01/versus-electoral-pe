export const CANONICAL_SITE_URL = "https://www.versuselectoral.com";

export function resolveSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL): string {
  if (!value) return CANONICAL_SITE_URL;

  try {
    const url = new URL(value);
    const isCanonicalOrigin =
      url.protocol === "https:" &&
      url.hostname === "www.versuselectoral.com" &&
      !url.port &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password;

    if (isCanonicalOrigin) return CANONICAL_SITE_URL;
  } catch {
    // Use the same safe error below for malformed and unapproved values.
  }

  throw new Error(`NEXT_PUBLIC_SITE_URL must be ${CANONICAL_SITE_URL}.`);
}

export const SITE_URL = resolveSiteUrl();
export const SITE_NAME = "Versus Electoral Perú";
export const SITE_DESCRIPTION =
  "Compara candidatos a las alcaldías de Lima 2026, sus planes de gobierno y noticias verificadas de fuentes oficiales y periodísticas.";
