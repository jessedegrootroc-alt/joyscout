# Scoring methodology

Alle gewichten staan in `src/server/scoring/weights.ts` en zijn daar aan te
passen. Scores zijn 0–100. AI verzint nooit een score; de enige AI-input is
een begrensde “design impression” binnen de Design Score.

## Website Score (0–100)

| Categorie   | Gewicht | Gemeten signalen (allemaal verifieerbaar) |
|-------------|---------|--------------------------------------------|
| Technical   | 25 %    | HTTPS (+redirect http→https), SSL geldig, HTTP 200, geen mixed content, broken links-ratio, JS-errors, failed requests, transfer size, viewport aanwezig, responsive (geen horizontale overflow op 375px), image-optimalisatie (PSI audits), CWV (LCP/CLS/TBT) |
| SEO         | 20 %    | title (aanwezig, 20–65 tekens), meta description (50–165), exact 1 H1, headingstructuur (geen overgeslagen niveaus), canonical, sitemap.xml, robots.txt, schema.org (+LocalBusiness), alt-teksten ≥ 80 %, indexeerbaar, Open Graph, lang-attribuut, local SEO (adres + plaatsnaam op pagina/title) |
| UX          | 20 %    | navigatie aanwezig (≤ 9 hoofdlinks), H1/heroText aanwezig, CTA aanwezig, contactmogelijkheden (tel/e-mail/formulier), leesbaarheid (woorden ≥ 150, fontgrootte ≥ 14px mobiel), responsive, eerste indruk (LCP ≤ 2.5 s / eigen load ≤ 3 s), favicon |
| Conversion  | 20 %    | waardepropositie (heroText met ≥ 4 woorden), CTA boven de fold, contact-CTA, telefoon zichtbaar, social proof (reviews/testimonials), reviews-widget, cases/portfolio, vertrouwenselementen (KvK, keurmerken, garanties), formulier, WhatsApp/booking |
| Performance | 15 %    | PSI performance (mobile 70 %, desktop 30 %); zonder PSI: derived uit TTFB, load, transfer size, requests (gelabeld “derived”) |

Aparte scores voor de UI:
- **Design Score** – responsive, webfonts, geen legacy markup (`<font>`, `<center>`, table-layout, marquee), moderne libs (geen jQuery 1.x / Bootstrap ≤ 3), copyright-jaar recent, favicon, hero-afbeelding, consistente fonts (≤ 3 families). Als AI heeft gedraaid telt `aiDesignImpression` voor max 40 % mee en wordt dat als “AI observation” getoond.
- **Mobile Score** – viewport, geen horizontale overflow, kleine-tekst-ratio, tap-target-issues (PSI `tap-targets`), mobiel menu aanwezig, PSI mobile performance.
- **Technical / SEO / UX / Conversion / Performance** – de categorie-scores hierboven.

Elke categorie berekent `score = Σ(gewicht_i × passed_i) / Σ(gewicht_i)` over
de beschikbare checks; checks zonder data (bv. PSI ontbreekt) worden uit de
noemer gelaten en gemarkeerd als “not measured”.

Betrouwbaarheidsregels:
- UX, Conversion, Design, Mobile en Performance worden alleen berekend als de
  echte pagina geladen is (`fetchOutcome = ok`, geen 403/captcha). Geblokkeerde
  of offline sites houden alleen de transport-/SEO-checks en krijgen het issue
  “Website blocks automated visitors — content checks skipped”.
- Zonder PageSpeed wordt Performance afgeleid uit eigen timings en begrensd op
  `derivedPerformanceCap` (80), zodat het nooit op een geverifieerde 100 lijkt.
- De ruwe audit (zonder HTML) wordt opgeslagen in `WebsiteAnalysis.rawAudit`;
  na het aanpassen van gewichten herbereken je alle scores zonder opnieuw te
  crawlen met `npx tsx --tsconfig tsconfig.json scripts/rescore.mts`.

## Opportunity Score (0–100)

| Component                       | Gewicht | Berekening |
|---------------------------------|---------|------------|
| Poor website                    | 30 %    | `100 − websiteScore`; geen website ⇒ 100 |
| Strong existing business        | 25 %    | rating (≥ 4.5 ⇒ 100, 4.0 ⇒ 70, 3.5 ⇒ 40), reviews (log-schaal, 100 reviews ⇒ 80, 250 ⇒ 100), businessStatus OPERATIONAL, telefoon aanwezig, branche-multiplier (commerciële branches ×1.0–1.1) |
| High reviews/rating combo       | 15 %    | bonus als rating ≥ 4.3 én reviews ≥ 25 (schaalt met reviews) |
| Conversion problems             | 15 %    | `100 − conversionScore`; geen website ⇒ 100 |
| SEO opportunity                 | 10 %    | `100 − seoScore` × relevantie (meer reviews ⇒ hoger) ; geen website ⇒ 80 |
| Contactability                  | 5 %     | e-mail 100 / telefoon 70 / formulier 40 / niets 0 |

Zonder Google-data (Overpass) tellen “business” componenten op basis van wat
wel bekend is (telefoon, status) en wordt de score gemarkeerd als “limited data”.

## Prioriteitslabels
- 🔥 **Hot Lead**: opportunity ≥ 80
- **High Opportunity**: 65–79
- **Good Business / Bad Website**: rating ≥ 4.3, reviews ≥ 25, websiteScore < 50
- **SEO Opportunity**: website aanwezig, seoScore < 45
- **No Website**: geen website gevonden
- **Needs Redesign**: designScore < 45 of ageVerdict = likely_outdated
- **Low Priority**: opportunity < 35

## Smart insights (regels, geen AI)
Voorbeelden: “4.9 rating + 320 reviews + outdated website”, “Strong business
with weak digital presence”, “No clear quote request above the fold”,
“Website not mobile friendly”, “High local demand but weak SEO”, “No website
found”, “Contact form missing – leads only via phone”.

## Website age indicators
Signalen → verdict: `likely_outdated` (≥ 3 signalen of copyright ≤ huidig jaar − 4
+ geen viewport), `possibly_outdated` (1–2 signalen), `modern` (0 signalen +
responsive + moderne libs), `unknown` (fetch mislukt). Nooit een exact bouwjaar.

## Recommended service (regelgebaseerd, AI mag verfijnen)
1. geen website → **New website**
2. websiteScore < 40 of likely_outdated → **Complete website redesign**
3. mobileScore < 45 → **Mobile redesign**
4. performanceScore < 40 → **Performance optimization**
5. conversionScore < 45 → **Conversion optimization**
6. seoScore < 45 en LocalBusiness/adres ontbreekt → **Local SEO**
7. seoScore < 55 → **SEO optimisation**
8. rating hoog, weinig reviews/onvolledig profiel → **Google Business optimization**
9. anders → **Landing page** (campagne-pagina) of “No clear need”

## AI cost gate
AI-analyse draait alleen als (a) een AI-key is geconfigureerd en (b) de pre-AI
opportunity score ≥ `UserSettings.aiMinOpportunity` (default 40), of de
gebruiker expliciet “Run AI analysis” klikt op de detailpagina.
