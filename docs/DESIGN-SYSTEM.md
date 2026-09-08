# LeadLens design system (Webjoy-richting)

Bron: de Webjoy-site (site.css + HTML). Gebruikt als designrichting, niet gekopieerd:
geen Webjoy-copy, -logo's, -smileys of -klantcontent. Alle tokens staan in
`src/app/globals.css`; componenten in `src/components/ui` bouwen erop voort.

## Typografie
| Rol | Font | Maat / gewicht |
|---|---|---|
| Display (dashboardgroet, foutpagina's) | Google Sans Flex 500, tracking -0.02em | 2.25–2.75rem, line-height 1.08 |
| Paginakop h1 | Google Sans Flex 500 | 1.75rem (md 2rem), leading 1.15 |
| Sectiekop h2 | Google Sans Flex 500 | 1.0625rem (17px) |
| Body | Google Sans Flex 400 | 14–15px, leading 1.55–1.65 |
| Secundaire tekst | idem, `text-secondary` (80% zwart) | 13–14px |
| Label / eyebrow / tabelkop | JetBrains Mono 500, uppercase, tracking .08em | 11px |
| Handgeschreven accent (spaarzaam) | Caveat 600 | 22–28px |
| Buttons | Google Sans Flex 500 | 13–14px |

Koppen zijn nooit bold, altijd medium (500).

## Kleuren (tokens)
| Token | Waarde | Gebruik |
|---|---|---|
| `--background` | #F3EFEA | pagina, sidebar |
| `--card` / `--popover` | #FFFFFF | kaarten, tabellen, menu's |
| `--foreground` | #323232 | tekst |
| `--muted-foreground` | rgba(50,50,50,.62) | secundaire tekst |
| `--border` | #E8DFD5 | subtiele randen |
| `--input` | #DDD3C7 | velden, outline-buttons |
| `--primary` | #1A1A1A → hover #000 | CTA-pill, actieve chips |
| `--brand` | #5E9BFF | focusring, links, één accent |
| `--destructive` | #E5484D | fouten |
| Tinten | groen #48F08B, geel #FCC934, oranje #FF864A, roze #FFBDF9, blauw #5E9BFF | alleen als 15–25 % achtergrondtint voor scores en labels |

Regels: één accentkleur (blauw), donker voor de primaire CTA, tinten uitsluitend
voor betekenis (score goed/matig/slecht, opportunity). Geen gradients, geen glow.

## UI
- **Buttons**: pill (`rounded-full`). Primary donker/wit; outline 1.5px `--input`
  transparant, hover 5 % zwart; ghost; destructive rood-tint. Active: scale .98.
- **Inputs/select/textarea**: wit, 1px `--input`, radius 12px, h-9/10, focusring brand.
- **Cards**: wit, 1px `--border`, radius 1.1rem (`rounded-lg`) tot 1.5rem voor
  hero-achtige kaarten, geen schaduw. Hover op klikbare kaarten: #fbfaf8.
- **Tabs**: line-variant met donkere onderstreep; pill-variant in `--foreground/6`.
- **Badges/tags**: pills, 11–12px medium; status-tags neutraal, semantische tinten
  alleen voor score/opportunity/labels. Bron-tags mono 10px outline.
- **Dropdowns/popovers/dialogs**: radius 1rem–1.5rem, 1px `--border`, flyout-schaduw
  `0 12px 32px -8px rgba(50,50,50,.16), 0 2px 8px rgba(50,50,50,.06)`.
- **Tabellen**: kop in mono-eyebrow, rijen 14px, hover #fbfaf8, container als kaart.
- **Navigatie**: sidebar in crème, actieve link als witte pill met rand; header
  frosted (blur) 64px hoog; zoekveld als pill.
- **Empty states**: gestippelde rand in `--input`, mono-eyebrow, korte uitleg, één CTA.

## Layout
- Contentbreedte max 1300px (tabellen 1600px), horizontale padding 20px / 32px.
- Verticale ritmiek: paginakop mb-8, secties gap 24px, kaart-padding 20–28px.
- Grid-gap 16–24px. Desktop-first, responsive tot 375px.

## Motion
- Transities `.2s ease`; reveals `.5s cubic-bezier(.16,1,.3,1)` (`--ease-spring`).
- Pagina-inhoud komt binnen met een lichte fade/rise (`.page-enter`).
- Pijlen in links schuiven 3px op hover; geen marquees of zwevende objecten in de app.
- `prefers-reduced-motion` schakelt alles uit.
