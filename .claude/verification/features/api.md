# API routes (read-only)

Run with `node scripts/control.mjs get "<path>" [--expect <text>]`. `get` refuses `/api/cron*` and `/api/scrape*` because they scrape and write. Observed 2026-11-13.

| Route | Input | Expected output |
| --- | --- | --- |
| `GET /api/candidatos` | `eleccion=municipal-2026` | 200, JSON array of 485 items with `id, nombre, partido, slug, totalNoticias, peorGravedad, gravedadCounts` |
| `GET /api/candidatos` | `eleccion=presidencial-2026` | 200, JSON array of 36 items (first slug `alex-gonzalez-castillo`) |
| `GET /api/noticias` | `candidato=<slug>&limit=1` | 200, `{ noticias, total, page, totalPages }` |
| `GET /api/propuestas` | `candidato=<slug>` | 200, `{ plan: { jneId, expediente, fuenteUrl, pdfUrl, ... } }` |
| `GET /api/onpe/conteo` | none | 200, `{ conteo: { actualizado, ambitos[43] } }`; ambito 0 is `lima-metropolitana` with `actasPct` and up to 10 `filas`. Returns 503 when the DB is down |
| `GET /api/visitantes` | none | 200, body `null` locally (likely no GA4 credentials here; not confirmed) |

## Edge cases

| Input | Observed |
| --- | --- |
| `/api/candidatos` with no `eleccion` | 200, 485 items (municipal default) |
| `/api/candidatos?eleccion=zzz` | 200, falls back to the municipal list instead of rejecting |
| `/api/propuestas` without `candidato` | 400 `{"error":"Falta el candidato"}` |
| `/api/propuestas?candidato=nope` | 200 `{"plan":null}` |
| `/api/noticias?candidato=nope&page=0` | **500** with a Prisma error text in the body (internal detail leaks). Pre-existing, not fixed here |
| `/api/noticias?...&limit=9999` | 200; only 1 news item exists for the test slug, so the cap on `limit` is unconfirmed |
| `/api/cron`, `/api/scrape` | not callable through `get`; they need `CRON_SECRET` / `SCRAPE_API_KEY`, and `/api/scrape` falls back to a hardcoded `dev-key-123` when the variable is unset |
