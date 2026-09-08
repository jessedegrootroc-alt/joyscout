import { GooglePlacesProvider } from "./google-places";
import { OverpassProvider } from "./overpass";
import type { BusinessProvider } from "./types";

const providers: BusinessProvider[] = [new GooglePlacesProvider(), new OverpassProvider()];

/** Returns the providers to use in preference order: Google when configured, otherwise Overpass. */
export function selectProviders(): BusinessProvider[] {
  const google = providers.find((p) => p.key === "google_places")!;
  const overpass = providers.find((p) => p.key === "overpass")!;
  return google.isConfigured() ? [google] : [overpass];
}
