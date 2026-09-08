# LeadLens

Find local businesses with an underperforming online presence, analyse their
websites, qualify them as prospects and prepare personalised outreach.
Built for web designers, agencies, SEO specialists and freelancers.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 + shadcn/ui ·
PostgreSQL 17 + Prisma 7 · Better Auth · pg-boss (Postgres job queue) ·
Playwright · Google Places API (New) / OpenStreetMap · PageSpeed Insights ·
Anthropic or OpenAI · ExcelJS.

Docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DATA-PROVIDERS.md`](docs/DATA-PROVIDERS.md), [`docs/SCORING.md`](docs/SCORING.md).

## Requirements

- Node 22.12+ (tested on 24)
- PostgreSQL 13+ running locally (`brew install postgresql@17 && brew services start postgresql@17`)
- Chromium for Playwright (`npx playwright install chromium`)

## Setup

```bash
cp .env.example .env          # fill in DATABASE_URL, BETTER_AUTH_SECRET and API keys
npm install                   # also runs `prisma generate`
createdb leadlens             # if the database does not exist yet
npx prisma migrate dev        # creates the schema
```

Run the web app and the background worker in two terminals:

```bash
npm run dev            # http://localhost:3000
npm run worker:watch   # pg-boss worker: discovery, Playwright audits, PSI, scoring, AI
```

Create an account at `/register`, then start at **Find Prospects**.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string (app + worker + pg-boss) |
| `BETTER_AUTH_SECRET` | yes | Session signing secret (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | yes | Public URL of the app |
| `GOOGLE_PLACES_API_KEY` | recommended | Places API (New) Text Search + Geocoding API. Without it, discovery falls back to OpenStreetMap (no ratings/reviews, fewer results). |
| `PAGESPEED_API_KEY` | recommended | PageSpeed Insights quota. Without a key only the mobile run is attempted and 429s are skipped (performance is then derived from own timings). |
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | optional | Enables AI website analysis, outreach and follow-up generation. `AI_PROVIDER` / `AI_MODEL` override the defaults (`claude-opus-5` / `gpt-4o-mini`). |
| `ANALYZE_CONCURRENCY` | optional | Parallel website audits in the worker (default 3) |
| `STORAGE_DIR` | optional | Where screenshots are stored (default `./storage`) |

API keys are only read server-side; nothing is exposed to the browser.

## How a scan works

`Find prospects` → `POST /api/scans` → pg-boss `scan.discover` job → geocode →
Google Places / Overpass → normalise → duplicate detection (place id, domain,
phone, name + address) → one `prospect.analyze` job per business with a
website: HTTP probe → Playwright (desktop + mobile screenshots, DOM metrics)
→ HTML/SEO checks → tech detection → robots/sitemap/contact page/broken
links → PageSpeed Insights → scoring engine → optional AI analysis → store.
The results page polls `GET /api/scans/:id` every two seconds.

Businesses without a website are kept and scored immediately (very high
opportunity, recommended service “New website”).

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run worker` / `worker:watch` | Background worker |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` / `db:generate` / `db:studio` | Prisma helpers |
| `npx tsx --tsconfig tsconfig.json scripts/audit-url.mts <url>` | Run the browser audit for one URL |
| `npx tsx --tsconfig tsconfig.json scripts/rescore.mts` | Recompute all scores from stored raw audits (after changing weights) |
| `npx tsx --tsconfig tsconfig.json scripts/reanalyze-all.mts` | Queue a forced re-analysis of every prospect with a website |

## Production notes

- Run `next build && next start` plus `npm run worker` (as a separate long-running process).
- Keep `storage/` on persistent disk (or swap the screenshot store for S3 in `src/server/analysis/browser.ts` + `src/app/api/screenshots`).
- Radar schedules live in pg-boss (`radar.run` cron per radar) and survive restarts.

Design system: see [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) (tokens in `src/app/globals.css`).
