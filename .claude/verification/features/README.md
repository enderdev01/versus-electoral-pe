# Feature map

Every row has a command you can run. Start the dev server first for `get` (`npm run dev`, port 3000); `screenshot` starts it by itself when the port is free.
Values below were observed on 2026-11-13 against the local dev server. Counts and ONPE figures change over time: check shape and status, not exact numbers.

| Feature | What it does | How to exercise it | Details |
| --- | --- | --- | --- |
| Home (official ONPE count + search) | Home with the official count block, district selector and candidate search | `node scripts/control.mjs screenshot /` | [pages.md](pages.md) |
| Presidential versus | Compare two presidential candidates | `node scripts/control.mjs get /versus` | [pages.md](pages.md) |
| Presidential list and profile | List and `/candidato/[slug]` profiles | `node scripts/control.mjs get /candidato` | [pages.md](pages.md) |
| Mayors list, profile and district | `/alcaldes`, `/alcaldes/[slug]`, `/alcaldes/distrito/[distrito]` | `node scripts/control.mjs screenshot /alcaldes --full-page` | [pages.md](pages.md) |
| Mayors versus | `/alcaldes/versus?ambito=&prioridad=&candidato=` | `node scripts/control.mjs get "/alcaldes/versus?ambito=lima-metropolitana"` | [pages.md](pages.md) |
| Support page | `/apoyanos` donation page | `node scripts/control.mjs get /apoyanos --expect "Ko-fi"` | [pages.md](pages.md) |
| Candidates API | `GET /api/candidatos?eleccion=` | `node scripts/control.mjs get "/api/candidatos?eleccion=municipal-2026"` | [api.md](api.md) |
| News API | `GET /api/noticias?candidato=&page=&limit=` | `node scripts/control.mjs get "/api/noticias?candidato=adelina-rivera-escudero&limit=1"` | [api.md](api.md) |
| Proposals API | `GET /api/propuestas?candidato=` (static JSON, no DB) | `node scripts/control.mjs get "/api/propuestas?candidato=adelina-rivera-escudero"` | [api.md](api.md) |
| ONPE count API | `GET /api/onpe/conteo`, the DB copy of the official count | `node scripts/control.mjs get /api/onpe/conteo --expect actualizado` | [api.md](api.md) |
| Visitors API | `GET /api/visitantes` (GA4 read) | `node scripts/control.mjs get /api/visitantes` | [api.md](api.md) |
| Screenshot | Headless capture of any route | `node scripts/control.mjs screenshot` | [pages.md](pages.md) |
| 3D flag scene | `VersusFlag3D` (React Three Fiber) | manual verification: not reachable | [canvas.md](canvas.md) |
| ONPE sync, cron, scrape, ingest scripts | Write to the database or the committed JSON | not wrapped on purpose (they write) | [writers.md](writers.md) |

Gate: `node scripts/control.mjs doctor`, then `node scripts/control.mjs verify` (typecheck, lint, test). Playwright specs in `tests/*.spec.ts` are not part of `verify`.
