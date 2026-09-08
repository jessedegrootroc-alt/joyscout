import { env } from "@/lib/env";
import type { BusinessProvider, DiscoveryInput, RawBusiness, SearchResult } from "./types";
import { haversineKm } from "./types";
import { recordUsage } from "./usage";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.googleMapsUri",
  "places.rating",
  "places.userRatingCount",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.businessStatus",
  "nextPageToken",
].join(",");

type Place = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
};

export class GooglePlacesProvider implements BusinessProvider {
  key = "google_places" as const;

  isConfigured() {
    return Boolean(env.googlePlacesKey);
  }

  async search(input: DiscoveryInput, onProgress?: (msg: string) => void): Promise<SearchResult> {
    const seen = new Map<string, RawBusiness>();
    let requestsUsed = 0;
    let budgetHit = false;
    const budget = input.requestBudget ?? Number.POSITIVE_INFINITY;
    const radiusM = Math.min(50_000, Math.max(500, input.radiusKm * 1000));
    const lang = input.language as "en" | "nl";
    const terms = input.industry ? (input.industry.terms[lang] ?? input.industry.terms.en) : [input.query];
    // Text Search returns max 60 results per query. For larger targets we add
    // synonym queries and, for wide radii, a small grid of sub-centres.
    const centers = input.maxResults > 60 && input.radiusKm >= 10 ? gridCenters(input.center, input.radiusKm) : [input.center];
    const queries: Array<{ term: string; center: { lat: number; lng: number }; radius: number }> = [];
    for (const term of terms) for (const c of centers) queries.push({ term, center: c, radius: centers.length > 1 ? radiusM / 2 : radiusM });

    outer: for (const q of queries) {
      if (seen.size >= input.maxResults) break;
      onProgress?.(`Google Places: "${q.term}" (${seen.size} found · ${requestsUsed} requests)`);
      let pageToken: string | undefined;
      for (let page = 0; page < 3; page++) {
        if (requestsUsed >= budget) {
          budgetHit = true;
          break outer;
        }
        const body: Record<string, unknown> = {
          textQuery: `${q.term} in ${input.locationLabel}`,
          pageSize: 20,
          languageCode: lang,
          regionCode: input.countryCode,
          locationBias: { circle: { center: { latitude: q.center.lat, longitude: q.center.lng }, radius: q.radius } },
        };
        if (input.industry?.googleType) body.includedType = input.industry.googleType;
        if (pageToken) body.pageToken = pageToken;
        const data = await this.request(body);
        requestsUsed++;
        await recordUsage("google_places").catch(() => {});
        for (const p of data.places ?? []) {
          if (!p.id || seen.has(p.id)) continue;
          if (p.location && haversineKm(input.center, { lat: p.location.latitude, lng: p.location.longitude }) > input.radiusKm * 1.15) continue;
          seen.set(p.id, toRaw(p, input.countryCode));
        }
        pageToken = data.nextPageToken;
        if (!pageToken || seen.size >= input.maxResults) break;
        await sleep(300);
      }
    }
    return { businesses: [...seen.values()].slice(0, input.maxResults), requestsUsed, budgetHit };
  }

  private async request(body: Record<string, unknown>, attempt = 0): Promise<{ places?: Place[]; nextPageToken?: string }> {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": env.googlePlacesKey, "X-Goog-FieldMask": FIELD_MASK },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        return this.request(body, attempt + 1);
      }
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Google Places HTTP ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  }
}

function toRaw(p: Place, fallbackCountry: string): RawBusiness {
  const comp = (t: string) => p.addressComponents?.find((c) => c.types.includes(t));
  const streetNumber = comp("street_number")?.longText;
  const route = comp("route")?.longText;
  return {
    source: "google_places",
    sourceRef: p.id,
    googlePlaceId: p.id,
    name: p.displayName?.text ?? "Unknown business",
    website: p.websiteUri ?? null,
    phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
    internationalPhone: p.internationalPhoneNumber ?? null,
    address: p.formattedAddress ?? null,
    street: route ? `${route}${streetNumber ? ` ${streetNumber}` : ""}` : null,
    postalCode: comp("postal_code")?.longText ?? null,
    city: comp("locality")?.longText ?? comp("postal_town")?.longText ?? comp("administrative_area_level_2")?.longText ?? null,
    region: comp("administrative_area_level_1")?.longText ?? null,
    countryCode: comp("country")?.shortText ?? fallbackCountry,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    googleMapsUrl: p.googleMapsUri ?? null,
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    businessStatus: p.businessStatus ?? null,
    types: p.types ?? (p.primaryType ? [p.primaryType] : []),
  };
}

function gridCenters(center: { lat: number; lng: number }, radiusKm: number) {
  const step = radiusKm / 2;
  const dLat = step / 111;
  const dLng = step / (111 * Math.cos((center.lat * Math.PI) / 180));
  return [
    center,
    { lat: center.lat + dLat, lng: center.lng },
    { lat: center.lat - dLat, lng: center.lng },
    { lat: center.lat, lng: center.lng + dLng },
    { lat: center.lat, lng: center.lng - dLng },
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
