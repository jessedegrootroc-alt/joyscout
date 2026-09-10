/**
 * Parses a pasted list into import items. Accepted line formats:
 *   "Bakkerij Jansen, Haarlem"        → name + city
 *   "Bakkerij Jansen"                 → name (city from the form default)
 *   "https://www.facebook.com/bakkerijjansen"  → name guessed from the page slug + facebook link
 *   "Bakkerij Jansen, Haarlem, https://facebook.com/..." → all three
 * Lines starting with # and empty lines are ignored.
 */
export type ImportItem = { name: string; city: string | null; facebook: string | null; raw: string };

const FB_RE = /https?:\/\/(?:www\.|m\.|web\.)?(?:facebook\.com|fb\.com)\/([^\s?#]+)/i;

export function parseImportLines(text: string, defaultCity?: string | null): ImportItem[] {
  const out: ImportItem[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    if (!raw || raw.startsWith("#")) continue;
    let facebook: string | null = null;
    let rest = raw;
    const fb = raw.match(FB_RE);
    if (fb) {
      facebook = fb[0].replace(/[),.;]+$/, "");
      rest = raw.replace(fb[0], "").replace(/[,\s]+$/, "").trim();
    }
    const parts = rest.split(/\s*[,;|\t]\s*/).map((x) => x.trim()).filter(Boolean);
    let name = parts[0] ?? "";
    let city = parts[1] ?? null;
    if (!name && facebook) name = nameFromFacebookUrl(facebook);
    if (!name) continue;
    if (!city && defaultCity) city = defaultCity;
    const key = `${name.toLowerCase()}|${(city ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, city, facebook, raw });
  }
  return out;
}

/** "facebook.com/Bakkerij-Jansen-102938" → "Bakkerij Jansen" */
export function nameFromFacebookUrl(url: string): string {
  const m = url.match(FB_RE);
  let slug = decodeURIComponent(m?.[1] ?? "");
  slug = slug.replace(/^(pages|pg|p|people)\//i, "").split("/")[0] ?? "";
  if (/^profile\.php/i.test(slug) || !slug) return "";
  slug = slug.replace(/-?\d{6,}$/g, "").replace(/[-._]+/g, " ").trim();
  return slug.replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
