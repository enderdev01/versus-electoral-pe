# Pages

Run with `node scripts/control.mjs get <path>` (status, size) or `screenshot <path>` (picture). Observed on the dev server, 2026-11-13.

| Input | Expected output | Exit |
| --- | --- | --- |
| `screenshot` (no args) | `ok screenshot http://localhost:3000/ -> $TMPDIR/transparencia-electoral-screenshot.png`; page shows the header, the red ticker, "Resultados oficiales ONPE", the search box and the official count block | 0 |
| `screenshot /alcaldes --full-page --out <file>` | `ok screenshot http://localhost:3000/alcaldes -> <file>` | 0 |
| `screenshot //x` | `FAIL route must be a path starting with a single "/"` | 1 |
| `get /` | HTTP 200, text/html, about 430 KB | 0 |
| `get /versus` | HTTP 200, about 70 KB | 0 |
| `get /candidato` | HTTP 200, about 136 KB | 0 |
| `get /alcaldes` | HTTP 200, about 238 KB | 0 |
| `get /alcaldes/adelina-rivera-escudero` | HTTP 200, about 110 KB (any slug from `/api/candidatos`) | 0 |
| `get /alcaldes/distrito/miraflores` | HTTP 200, about 91 KB | 0 |
| `get "/alcaldes/versus?ambito=lima-metropolitana"` | HTTP 200 | 0 |
| `get /apoyanos --expect "Ko-fi"` | HTTP 200, text found | 0 |

## Edge cases

| Input | Observed |
| --- | --- |
| `get /alcaldes/zzz` | HTTP 404 |
| `get /alcaldes/distrito/zzz` | HTTP 404 |
| `get /candidato/zzz` | HTTP 200, not 404: unknown presidential slug still renders a page. Look at the page before trusting the status |
| `get "/alcaldes/versus?candidato=zzz"` | HTTP 200 |
| `get /no-existe` | HTTP 404 |
| `get //evil.com` | `FAIL path must start with a single "/"`, exit 1, no request sent |

## Notes

- The home count block (`OfficialCount`) no longer polls: it renders the snapshot in `src/lib/conteo-oficial-data.json` committed with the build (PR 37).
- `/local-admin/news-audit` answers 200 on loopback only; it is an operator tool, not a public feature. Do not exercise its POST/PATCH.
