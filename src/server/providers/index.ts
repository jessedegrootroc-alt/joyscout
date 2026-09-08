import { GooglePlacesProvider } from "./google-places";
import { OverpassProvider } from "./overpass";
import type { BusinessProvider } from "./types";
import { getGoogleBudget, type BudgetStatus } from "./usage";

const google = new GooglePlacesProvider();
const overpass = new OverpassProvider();

export type ProviderPlan = { providers: BusinessProvider[]; budget: BudgetStatus | null; note: string | null; requestBudget?: number };

/**
 * Google when configured and within the monthly budget, otherwise OpenStreetMap.
 * A scan needs at least a few requests to be useful; below that we fall back
 * (or refuse when fallback is disabled).
 */
export async function planProviders(): Promise<ProviderPlan> {
  if (!google.isConfigured()) return { providers: [overpass], budget: null, note: null };
  const budget = await getGoogleBudget();
  if (budget.remaining < 3) {
    if (budget.fallback) {
      return { providers: [overpass], budget, note: `Google Places monthly budget reached (${budget.used}/${budget.budget}); used OpenStreetMap instead. Resets in ${budget.resetsInDays} day(s).` };
    }
    throw new Error(`Google Places monthly budget reached (${budget.used}/${budget.budget}). Raise the budget in Settings or enable the OpenStreetMap fallback.`);
  }
  return { providers: [google], budget, note: null, requestBudget: budget.remaining };
}

/** @deprecated kept for callers that only need the configured provider list */
export function selectProviders(): BusinessProvider[] {
  return google.isConfigured() ? [google] : [overpass];
}
