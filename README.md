<p align="center">
  <b>🗳️ Versus Electoral Perú</b><br>
  <sub>Monitorea noticias sobre los candidatos presidenciales del Perú y las clasifica por gravedad con IA.</sub>
</p>

<p align="center">
  <img src="screenshot.png" alt="Versus Electoral Perú" width="600">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_16-000000?style=flat&logo=next.js&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white" alt="Prisma">
  <img src="https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white" alt="OpenAI">
  <img src="https://img.shields.io/badge/Three.js-000000?style=flat&logo=three.js&logoColor=white" alt="Three.js">
  <img src="https://img.shields.io/badge/Deploy-Vercel-000000?style=flat&logo=vercel" alt="Vercel">
</p>

---

## Qué hace

Web en Next.js + Prisma que **monitorea noticias** sobre los candidatos presidenciales del Perú y las **clasifica por gravedad** usando IA (OpenAI/Anthropic). Hace scraping de fuentes, las procesa con un cron automático y las visualiza (incluye vistas 3D con Three.js).

## Funcionalidades

- Monitoreo y scraping de noticias sobre candidatos.
- Clasificación por gravedad con IA.
- Cron automático (Vercel cron + GitHub Actions, 2 ejecuciones diarias).
- Ingesta de planes municipales y fotos de candidatos.
- Visualización 3D (React Three Fiber).
- Base de datos Prisma (Postgres en Supabase).

## Stack

| Capa | Stack |
|------|-------|
| Framework | Next.js 16 (App Router) |
| ORM | Prisma |
| Base de datos | Postgres (Supabase) |
| IA | OpenAI / Anthropic |
| Scraping | Cheerio + axios |
| 3D | Three.js / React Three Fiber |

## Uso local

```bash
npm install
cp .env.example .env
npm run db:migrate:dev
npm run db:seed
npm run dev
```

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | Conexión Postgres (pooler para serverless) |
| `DIRECT_URL` | Conexión directa para migraciones |
| `CRON_SECRET` | Protege el endpoint `/api/cron` |
| `SCRAPE_API_KEY` | Protege `/api/scrape` |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Clasificación con IA (opcional) |

## Cron automático

Configurado en `vercel.json` (`/api/cron`, `0 5 * * *`). El endpoint valida `Authorization: Bearer <CRON_SECRET>`. Para 2 corridas diarias en plan Hobby se complementa con `.github/workflows/cron-midday.yml`.

## Scripts útiles

```bash
npm run scrape            # scraping manual vía /api/scrape
npm run cron              # scraping local por script
npm run db:migrate:deploy # migraciones en producción
npm run db:seed           # seed de candidatos
```

---

<p align="center"><sub>Hecho con ❤️ por <a href="https://github.com/anthoniriv">Anthoni Rivera</a></sub></p>
