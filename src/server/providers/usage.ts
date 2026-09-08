import { prisma } from "@/lib/prisma";

/**
 * Monthly usage counters for paid APIs. Google's free allowance resets per
 * calendar month, so the counter key is "YYYY-MM" (UTC).
 */
export type UsageProvider = "google_places" | "google_geocoding" | "pagespeed";

export function currentMonth(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function recordUsage(provider: UsageProvider, n = 1) {
  const month = currentMonth();
  await prisma.apiUsage.upsert({
    where: { provider_month: { provider, month } },
    create: { provider, month, count: n },
    update: { count: { increment: n } },
  });
}

export async function getMonthUsage(provider: UsageProvider) {
  const row = await prisma.apiUsage.findUnique({ where: { provider_month: { provider, month: currentMonth() } } });
  return row?.count ?? 0;
}

export type BudgetStatus = {
  budget: number;
  used: number;
  remaining: number;
  fallback: boolean;
  /** Days until the counter resets (start of next month, UTC) */
  resetsInDays: number;
};

/** Google Places budget for the workspace (settings are workspace-wide). */
export async function getGoogleBudget(): Promise<BudgetStatus> {
  const [settings, used] = await Promise.all([prisma.userSettings.findFirst({ select: { googleMonthlyBudget: true, googleBudgetFallback: true } }), getMonthUsage("google_places")]);
  const budget = settings?.googleMonthlyBudget ?? 900;
  const now = new Date();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { budget, used, remaining: Math.max(0, budget - used), fallback: settings?.googleBudgetFallback ?? true, resetsInDays: Math.ceil((nextMonth.getTime() - now.getTime()) / 86_400_000) };
}

export class BudgetExceededError extends Error {
  constructor(public readonly provider: UsageProvider) {
    super(`${provider} monthly budget reached`);
  }
}
