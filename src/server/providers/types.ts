import type { Industry } from "@/lib/industries";

export type GeoPoint = { lat: number; lng: number };

export type DiscoveryInput = {
  /** Free text as entered by the user */
  query: string;
  industry: Industry | null;
  center: GeoPoint;
  radiusKm: number;
  countryCode: string;
  language: string;
  maxResults: number;
  locationLabel: string;
};

export type RawBusiness = {
  source: "google_places" | "overpass";
  sourceRef: string;
  name: string;
  website?: string | null;
  phone?: string | null;
  internationalPhone?: string | null;
  email?: string | null;
  address?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  region?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  googlePlaceId?: string | null;
  googleMapsUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  businessStatus?: string | null;
  types?: string[];
  socialLinks?: Record<string, string>;
};

export interface BusinessProvider {
  key: "google_places" | "overpass";
  isConfigured(): boolean;
  search(input: DiscoveryInput, onProgress?: (msg: string) => void): Promise<RawBusiness[]>;
}

export function haversineKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
