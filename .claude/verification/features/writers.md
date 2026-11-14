# Commands that write (not wrapped)

None of these has a `control.mjs` command, on purpose: running them changes the database or committed files. Run them only when the human asks.

| Command | Writes |
| --- | --- |
| `npm run sync:onpe` | `ConteoOnpe` row (`erm-2026-lima`) and `src/lib/conteo-oficial-data.json` |
| `npm run cron`, `POST /api/scrape`, `GET /api/cron` | scrape news and write them to the DB |
| `npm run ingest:planes-municipales`, `ingest:fotos-municipales`, `backfill:noticias-municipales` | DB rows and files under `public/` |
| `npm run db:push`, `db:migrate:*`, `db:seed` | schema and data |
| `npm run gen:fotos-manifest`, `gen:avatars` | generated manifest and images |

The LaunchAgent `com.onilabs.versus-onpe-sync` runs `sync:onpe` every 60 s when loaded; check `launchctl list` before assuming the JSON is stable.

Read-only checks that are safe: `npm run check:site-url`, `npm run check:isr`.
