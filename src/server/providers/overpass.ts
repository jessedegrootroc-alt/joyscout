import type { BusinessProvider, DiscoveryInput, RawBusiness, SearchResult } from "./types";
import { haversineKm } from "./types";

const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
/** Two passes over all mirrors with growing back-off before giving up. */
const BACKOFF_MS = [3000, 8000];
const UA = "Joyscrape/0.1 (prospecting tool; contact via app operator)";

type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

/**
 * Free fallback provider using OpenStreetMap data. No ratings/reviews, but
 * real businesses with website/phone/email tags. Rate-limited; one query/scan.
 */
export class OverpassProvider implements BusinessProvider {
  key = "overpass" as const;

  isConfigured() {
    return true;
  }

  async search(input: DiscoveryInput, onProgress?: (msg: string) => void): Promise<SearchResult> {
    const radiusM = Math.min(50_000, Math.max(500, input.radiusKm * 1000));
    const around = `(around:${radiusM},${input.center.lat},${input.center.lng})`;
    // Predefined industries: fast tag selectors. Custom terms: server-side name
    // regexes time out on the public Overpass servers for wide radii, so we fetch
    // all named craft/office/shop elements (radius capped) and filter by name here.
    const isCustom = !input.industry?.osm?.length;
    const customRadiusM = Math.min(radiusM, 15_000);
    const customAround = `(around:${customRadiusM},${input.center.lat},${input.center.lng})`;
    const nameWords = input.query.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, "")).filter((w) => w.length >= 4);
    const nameMatch = (name: string) => {
      const n = name.toLowerCase();
      return nameWords.length ? nameWords.some((w) => n.includes(w)) : n.includes(input.query.toLowerCase());
    };
    const selectors = isCustom ? ['["craft"]["name"]', '["office"]["name"]', '["shop"]["name"]'] : input.industry!.osm;
    const parts = selectors.map((sel) => `nwr${sel}${isCustom ? customAround : around};`).join("\n");
    const timeout = isCustom ? 120 : 60;
    const ql = `[out:json][timeout:${timeout}];\n(\n${parts}\n);\nout center tags qt;`;
    onProgress?.(isCustom ? `OpenStreetMap (Overpass): fetching named businesses within ${Math.round(customRadiusM / 1000)} km to match “${input.query}”` : "OpenStreetMap (Overpass): querying businesses");

    let lastErr: Error | null = null;
    const attempts = BACKOFF_MS.flatMap((wait, round) => ENDPOINTS.map((endpoint) => ({ endpoint, wait, round })));
    for (const [idx, { endpoint, wait, round }] of attempts.entries()) {
      if (round > 0 && idx % ENDPOINTS.length === 0) onProgress?.(`OpenStreetMap (Overpass): mirrors busy, retrying (round ${round + 1})`);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": UA },
          body: `data=${encodeURIComponent(ql)}`,
          signal: AbortSignal.timeout((timeout + 30) * 1000),
        });
        if (res.status === 429 || res.status === 504 || res.status === 406) {
          lastErr = new Error(`Overpass HTTP ${res.status} (rate limited or overloaded)`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
        const data = (await res.json()) as { elements: Element[]; remark?: string };
        if (data.remark && /timed out|out of memory|runtime error/i.test(data.remark) && data.elements.length === 0) throw new Error(`Overpass: ${data.remark.slice(0, 160)}`);
        onProgress?.(`OpenStreetMap (Overpass): ${data.elements.length} elements received`);
        const out: RawBusiness[] = [];
        const seenNames = new Set<string>();
        // Closest businesses first so the result cap keeps the most relevant ones.
        const dist = (el: Element) => {
          const lat = el.lat ?? el.center?.lat;
          const lng = el.lon ?? el.center?.lon;
          return lat != null && lng != null ? haversineKm(input.center, { lat, lng }) : Number.MAX_SAFE_INTEGER;
        };
        data.elements.sort((x, y) => dist(x) - dist(y));
        for (const el of data.elements) {
          const t = el.tags ?? {};
          if (!t.name) continue;
          if (isCustom && !nameMatch(t.name)) continue;
          // Name-regex matches can hit streets/buildings: require a business-ish tag or contact data.
          if (!(t.craft || t.shop || t.office || t.amenity || t.healthcare || t.company || t.industrial || t.website || t["contact:website"] || t.phone || t["contact:phone"] || t.email)) continue;
          if (t.highway || t.railway || t.waterway || t.natural || t.landuse) continue;
          const key = `${t.name.toLowerCase()}|${t["addr:postcode"] ?? ""}`;
          if (seenNames.has(key)) continue;
          seenNames.add(key);
          const lat = el.lat ?? el.center?.lat ?? null;
          const lng = el.lon ?? el.center?.lon ?? null;
          const street = t["addr:street"] ? `${t["addr:street"]}${t["addr:housenumber"] ? ` ${t["addr:housenumber"]}` : ""}` : null;
          const address = [street, [t["addr:postcode"], t["addr:city"]].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
          const social: Record<string, string> = {};
          for (const [k, net] of [["contact:facebook", "facebook"], ["contact:instagram", "instagram"], ["contact:linkedin", "linkedin"], ["contact:twitter", "twitter"], ["contact:youtube", "youtube"]] as const) {
            if (t[k]) social[net] = t[k].startsWith("http") ? t[k] : `https://${net === "twitter" ? "x.com" : `${net}.com`}/${t[k]}`;
          }
          out.push({
            source: "overpass",
            sourceRef: `${el.type}/${el.id}`,
            name: t.name,
            website: t.website ?? t["contact:website"] ?? t.url ?? null,
            phone: t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? null,
            email: t.email ?? t["contact:email"] ?? null,
            address,
            street,
            postalCode: t["addr:postcode"] ?? null,
            city: t["addr:city"] ?? null,
            countryCode: (t["addr:country"] ?? input.countryCode).toUpperCase(),
            lat,
            lng,
            types: [t.craft, t.shop, t.amenity, t.office, t.healthcare].filter(Boolean) as string[],
            socialLinks: Object.keys(social).length ? social : undefined,
          });
          if (out.length >= input.maxResults) break;
        }
        return { businesses: out, requestsUsed: 0, budgetHit: false };
      } catch (err) {
        lastErr = err as Error;
      }
    }
    throw lastErr ?? new Error("Overpass unavailable");
  }
}

