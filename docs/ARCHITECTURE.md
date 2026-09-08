# LeadLens – Architectuur (Fase 1)

LeadLens vindt lokale bedrijven, analyseert hun website, kwalificeert ze als
prospect voor webdesign/SEO/conversion-werk en bereidt outreach voor.
Dit document beschrijft informatie-architectuur, user flows, technische
architectuur en de scan-pipeline. Zie ook:

- `DATA-PROVIDERS.md` – waar bedrijfsdata en metingen vandaan komen
- `SCORING.md` – Website Score, Opportunity Score, labels en insights
- `prisma/schema.prisma` – database schema (bron van waarheid)

## 1. Information architecture

```
/                      Dashboard        – funnel, top opportunities, follow-ups due, recent scans
/find                  Find Prospects   – 3-staps formulier → start scan → live voortgang
/scans                 Scrapes          – scan-history, klik = resultaten van die scan
/scans/[id]            Scan results     – live tabel met prospects + pipeline-status
/prospects             Prospects        – complete prospectdatabase, filters, bulk actions
/prospects/[id]        Prospect detail  – scores, screenshots, AI, SEO-audit, tech, CRM, outreach
/lists                 Lists            – eigen lijsten (many-to-many met prospects)
/lists/[id]            List detail      – tabel gefilterd op lijst
/outreach              Outreach         – alle gegenereerde berichten, per prospect
/follow-ups            Follow-ups       – prospects met followUpAt, gesorteerd op datum
/radar                 Radar            – automatische periodieke scans → lijst
/saved-searches        Saved searches   – herbruikbare zoekopdrachten
/settings              Settings         – afzendergegevens, outreach-taal, API-status
/login, /register      Auth
```

Globale zoekbalk (⌘K) zoekt op bedrijfsnaam, website, e-mail, stad en branche
via `GET /api/search?q=`.

## 2. User flows

### 2.1 Find prospects (kernflow)
1. Gebruiker kiest branche (voorgedefinieerd of eigen term), locatie
   (stad/regio/postcode, land), straal en optionele filters
   (min. reviews, website vereist, max. Website Score, min. Opportunity Score).
2. `POST /api/scans` maakt een `Scan` (status QUEUED) en plaatst een
   `scan.discover` job in de queue.
3. UI navigeert naar `/scans/[id]` en pollt `GET /api/scans/[id]` elke 2 s.
   Stages: Searching businesses → Finding websites → Analyzing websites →
   Running SEO checks → Calculating scores → Done. Prospects verschijnen in de
   tabel zodra ze klaar zijn (ook zonder website).
4. Gebruiker sorteert op Opportunity Score, opent details, voegt toe aan lijst,
   genereert outreach of exporteert.

### 2.2 Prospect → outreach → CRM
Detailpagina → “Generate outreach” (channel/tone/length) → bericht op basis van
analyse → kopiëren → status “Contacted” + contactdatum → follow-up datum →
follow-up berichten (3/7/14 dagen) → status bijwerken → notities/timeline.

### 2.3 Radar
Gebruiker maakt Radar (branche, locatie, filters, frequentie). pg-boss cron
plant `radar.run`; iedere run maakt een Scan met `radarId`, nieuwe prospects
die aan de filters voldoen komen in de gekoppelde lijst. Duplicaten worden via
de standaard dedupe herkend en niet opnieuw toegevoegd.

## 3. Technische architectuur

| Laag            | Keuze                                   | Waarom |
|-----------------|-----------------------------------------|--------|
| Frontend + API  | Next.js 16 (App Router), TypeScript     | Server components voor data-heavy tabellen, route handlers voor API |
| Styling         | Tailwind v4 + shadcn/ui (radix)         | Compacte B2B UI, toegankelijke primitives |
| Tabellen        | TanStack Table                          | Sorteren/selecteren/kolommen client-side op server-gefilterde data |
| Database        | PostgreSQL 17 + Prisma 7 (`@prisma/adapter-pg`) | Relationeel model, JSON-kolommen voor audits |
| Auth            | Better Auth (email + password, Prisma adapter) | Zelf-gehost, geen externe afhankelijkheid, sessions in DB |
| Jobs            | pg-boss 12 (Postgres-based queue)       | Retries, backoff, cron, concurrency zonder Redis |
| Browser         | Playwright (Chromium)                   | Screenshots desktop/mobile/full-page + DOM-metingen |
| Performance     | PageSpeed Insights API v5               | Echte Lighthouse + CrUX data |
| Business data   | Google Places API (New) → fallback OSM Overpass | Zie DATA-PROVIDERS.md |
| AI              | Anthropic of OpenAI (provider-abstractie) | Kwalitatieve analyse + outreach, nooit scores |
| Export          | ExcelJS (XLSX) + eigen CSV writer       | Echte .xlsx die Excel/Sheets direct openen |

### Processen
```
next dev / next start      – web + API (poort 3000)
npm run worker             – pg-boss worker (tsx src/server/worker.ts)
```
De webapp schrijft alleen jobs weg; alle zware stappen (Places, Playwright,
PSI, AI) draaien in de worker. Beide processen delen dezelfde Postgres.

### Mappenstructuur
```
src/app/(app)/...            pagina's achter login
src/app/(auth)/login|register
src/app/api/...              route handlers (auth-guarded)
src/components/              UI (shadcn in components/ui)
src/lib/                     gedeelde types, industries, utils, auth, prisma
src/server/providers/        business data providers (interface + implementaties)
src/server/analysis/         fetch, screenshots, seo, tech-detect, psi, age, content
src/server/scoring/          scoring engine + gewichten
src/server/ai/               llm provider abstractie, analyse + outreach prompts
src/server/jobs/             pg-boss queues, handlers, worker bootstrap
src/server/export/           xlsx/csv
storage/screenshots/<prospectId>/  (buiten git, via API geserveerd)
```

## 4. Scan-pipeline (background jobs)

```
scan.discover (1 job per scan)
  1. Geocode locatie (Google Geocoding of Nominatim)
  2. Providers bevragen (Places Text Search met paginering, optioneel grid)
  3. Normaliseren (naam, telefoon E.164, domein, adres)
  4. Dedupliceren t.o.v. bestaande prospects van de gebruiker
     (placeId → domein → telefoon → naam+adres)
  5. Prospect + ScanProspect rows schrijven, Activity DISCOVERED
  6. Per prospect: geen website → status NO_WEBSITE + scoring direct;
     wél website → prospect.analyze job (singletonKey = prospectId)

prospect.analyze (1 job per prospect, concurrency ANALYZE_CONCURRENCY)
  1. Cache-check: analyse < 7 dagen oud voor dit domein → hergebruiken
  2. Fetch (HEAD/GET, redirects, https-upgrade, SSL-fout, timeout)
  3. Playwright: laad desktop 1440×900 + mobile 375×812, screenshots,
     DOM-metingen (CTA above fold, forms, nav, telefoon, overflow, fonts,
     JS-errors, requests, transfer size, timings)
  4. HTML checks (cheerio): SEO, schema, OG, alt, links, copyright, tech
  5. robots.txt + sitemap.xml + e-mail/social discovery (home + contactpagina)
  6. Broken links (sample ≤ 15 interne links, HEAD)
  7. PageSpeed Insights (mobile + desktop) – overslaan bij quota/fout
  8. Scoring engine → checks, issues, scores, labels, insights, age verdict
  9. AI-analyse indien geconfigureerd én pre-AI opportunity ≥ drempel
 10. Opslaan (WebsiteAnalysis upsert, Prospect denormalisatie), Activity ANALYZED
 11. Scan-tellers bijwerken; als alles klaar → Scan COMPLETED

radar.run (cron via pg-boss schedule) → maakt Scan met radarId → scan.discover
```

Foutafhandeling: iedere stap is try/catch met een `fetchOutcome`; een fout bij
één website faalt alleen die `ScanProspect`, nooit de scan. pg-boss retries:
`scan.discover` 2× (backoff), `prospect.analyze` 1× (backoff), expire 10 min.

### Live updates
`GET /api/scans/[id]` retourneert status, stage, tellers en de laatste
prospects; de UI pollt tot status ∈ {COMPLETED, FAILED, CANCELLED}.

## 5. Security
- Alle API keys uitsluitend server-side (`process.env`), nooit in `NEXT_PUBLIC_*`.
- Elke route handler en page gebruikt `requireUser()`; iedere Prisma-query is
  gescoped op `userId`.
- Screenshots worden via `/api/screenshots/[prospectId]/[kind]` geserveerd na
  ownership-check, nooit uit `/public`.
- Exports draaien server-side met dezelfde ownership-check.

## 6. Kostenbeheersing
- Places: `maxResults` per scan, paginering stopt zodra genoeg resultaten.
- Analyse-cache per domein (7 dagen), zodat herscans en Radar geen dubbele
  Playwright/PSI/AI-kosten maken.
- Goedkope checks eerst; AI pas boven de opportunity-drempel (`aiMinOpportunity`).
- PSI: 1 call per strategie, met retry/backoff; zonder key wordt PSI beperkt
  tot 1 strategie (mobile) en bij 429 overgeslagen (performance score wordt dan
  “derived” uit eigen timings).
