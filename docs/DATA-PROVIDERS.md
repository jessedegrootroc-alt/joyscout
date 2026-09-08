# Data providers

## Business discovery

Interface: `src/server/providers/types.ts`

```ts
interface BusinessProvider {
  key: 'google_places' | 'overpass';
  isConfigured(): boolean;
  search(input: DiscoveryInput): Promise<RawBusiness[]>;
}
```

`DiscoveryInput` = { query, industry (definition), center {lat,lng}, radiusKm,
countryCode, language, maxResults }.

### 1. Google Places API (New) – primair
- Endpoint `POST https://places.googleapis.com/v1/places:searchText`
- Headers: `X-Goog-Api-Key`, `X-Goog-FieldMask`
- Field mask (Enterprise SKU, want we hebben rating/telefoon/website nodig):
  `places.id,places.displayName,places.formattedAddress,places.addressComponents,
   places.location,places.types,places.primaryType,places.googleMapsUri,
   places.rating,places.userRatingCount,places.nationalPhoneNumber,
   places.internationalPhoneNumber,places.websiteUri,places.businessStatus,nextPageToken`
- `textQuery` = "<lokale zoekterm> in <locatie>", `locationBias.circle`
  (max 50 km), `includedType` als de branche een bekend Places-type heeft,
  `languageCode`/`regionCode` op basis van land.
- Max 60 resultaten per query (3 pagina's). Voor `maxResults` > 60 gebruiken we
  synoniemen per branche (bv. "dakdekker", "dakdekkersbedrijf", "roofing") en
  optioneel een grid van sub-centra binnen de straal; alles wordt gededupliceerd
  op place id.
- Resultaten buiten de straal (haversine) worden weggefilterd.
- Env: `GOOGLE_PLACES_API_KEY` (Places API (New) + Geocoding API inschakelen).

### 2. OpenStreetMap Overpass – fallback (gratis, geen key)
- Endpoint `https://overpass-api.de/api/interpreter` (met User-Agent)
- Query op OSM-tags per branche (`craft=roofer`, `craft=painter`,
  `amenity=dentist`, …) met `nwr[...](around:<m>,<lat>,<lng>)`; resultaten
  worden op afstand tot het centrum gesorteerd vóór de `maxResults`-cap.
- Eigen zoektermen: server-side naam-regexes lopen op de publieke servers vast
  (60–180 s), dus halen we alle benoemde `craft`/`office`/`shop`-elementen
  binnen max. 15 km op en filteren op naam in de worker. Gemeten: ~20 s,
  weinig treffers – voor eigen termen is de Google Places key sterk aanbevolen.
- Levert naam, website, telefoon, e-mail (contact:*), adres. Geen ratings.
  Prospects krijgen `source = "overpass"`; de UI toont dat ratings ontbreken.
- Beleid: ≤ 1 query per scan, 30 s pauze bij 429/406.

### Budgetbewaking (gratis blijven)
- Elke Google Places Text Search-aanvraag wordt geteld in `ApiUsage` (per
  kalendermaand, UTC). Geocoding en PageSpeed worden ook geteld, maar alleen
  ter informatie.
- `UserSettings.googleMonthlyBudget` (default 900, onder Googles gratis
  maandhoeveelheid van ~1.000 voor de Enterprise-SKU) begrenst het aantal
  aanvragen. `planProviders()` kiest Google zolang er ≥ 3 aanvragen over zijn;
  daarna OpenStreetMap (`googleBudgetFallback = true`) of een duidelijke fout.
- Een scan die halverwege het budget raakt, stopt met pagineren en zet een
  `providerNote` op de scan die in de UI wordt getoond.
- Settings toont verbruik, resterend budget en de resetdatum; Find Prospects
  toont het resterende aantal vóór een scan.
- Stel in de Google Cloud Console óók een dagquotum in als tweede vangnet.

### Geocoding
- Met Google key: Geocoding API (`region` = land).
- Zonder: Nominatim (`https://nominatim.openstreetmap.org/search`, 1 req/s,
  User-Agent verplicht, `countrycodes`).

## Website data (eigen metingen)
| Bron                | Wat | Label in UI |
|---------------------|-----|-------------|
| HTTP fetch          | status, redirects, https, SSL, TTFB, HTML-grootte | Verified |
| Playwright          | screenshots, DOM (CTA, forms, nav, telefoon), JS-errors, requests, timings, 375px-overflow, fontgroottes | Verified |
| cheerio HTML        | title, meta, headings, canonical, schema.org, OG, alt, links, copyright | Verified |
| robots.txt/sitemap  | aanwezig/ontbreekt, noindex | Verified |
| Contactpagina crawl | e-mail (mailto/regex), social links, WhatsApp | Verified |
| Tech detection      | CMS/framework/analytics/pixels/hosting via headers + DOM-patterns (`src/server/analysis/tech-detect.ts`) | Derived |
| PageSpeed Insights  | Lighthouse performance/accessibility/best-practices/SEO, LCP/CLS/TBT/FCP/SI, CrUX | Verified (extern) |
| Age indicators      | copyright-jaar, jQuery 1.x, Bootstrap 2/3, table-layout, `<font>`, geen viewport, Flash | Derived |
| AI                  | sterke punten, problemen, kansen, aanbevolen dienst, design-indruk | AI observation |

Elk `check`/`issue`/`insight` record draagt een `source` veld
(`google_business` | `website` | `pagespeed` | `derived` | `ai`) zodat de UI
verified vs derived vs AI kan tonen.

## Performance
- `GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=&strategy=mobile|desktop&category=performance&category=seo&category=accessibility&category=best-practices&key=`
- Zonder key: lage quota → alleen mobile, en 429 ⇒ overslaan.
- Env: `PAGESPEED_API_KEY` (optioneel).

## AI
- Provider-abstractie `src/server/ai/llm.ts`: Anthropic (default als
  `ANTHROPIC_API_KEY` aanwezig) of OpenAI (`OPENAI_API_KEY`).
- Input = gestructureerde feiten (checks, issues, metingen, bedrijfsdata),
  output = JSON met strengths / issues / opportunities / recommendedService /
  designImpression (0–100, alleen gebruikt als begrensde component van de
  Design Score, zie SCORING.md).
- Outreach en follow-ups gebruiken dezelfde abstractie.
