import { env } from "@/lib/env";
import type { GeoPoint } from "./types";

export type GeocodeResult = GeoPoint & { label: string; city?: string; region?: string; provider: "google" | "nominatim" };

const UA = "Joyscrape/0.1 (prospecting tool; contact via app operator)";

export async function geocode(location: string, countryCode: string): Promise<GeocodeResult | null> {
  if (env.googlePlacesKey) {
    const g = await geocodeGoogle(location, countryCode).catch(() => null);
    if (g) return g;
  }
  return geocodeNominatim(location, countryCode);
}

async function geocodeGoogle(location: string, countryCode: string): Promise<GeocodeResult | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", location);
  url.searchParams.set("region", countryCode.toLowerCase());
  url.searchParams.set("components", `country:${countryCode}`);
  url.searchParams.set("key", env.googlePlacesKey);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const data = (await res.json()) as { status: string; results: Array<{ formatted_address: string; geometry: { location: { lat: number; lng: number } }; address_components: Array<{ long_name: string; types: string[] }> }> };
  if (data.status !== "OK" || !data.results?.length) return null;
  const r = data.results[0];
  const comp = (t: string) => r.address_components.find((c) => c.types.includes(t))?.long_name;
  return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, label: r.formatted_address, city: comp("locality") ?? comp("postal_town"), region: comp("administrative_area_level_1"), provider: "google" };
}

let lastNominatim = 0;
async function geocodeNominatim(location: string, countryCode: string): Promise<GeocodeResult | null> {
  // Nominatim usage policy: max 1 request per second, identify your app.
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatim = Date.now();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", location);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", countryCode.toLowerCase());
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string; address?: Record<string, string> }>;
  if (!data.length) return null;
  const r = data[0];
  const a = r.address ?? {};
  return { lat: Number(r.lat), lng: Number(r.lon), label: r.display_name, city: a.city ?? a.town ?? a.village ?? a.municipality, region: a.state, provider: "nominatim" };
}
