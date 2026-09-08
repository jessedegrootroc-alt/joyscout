/** Dev check: budget guard behaviour with a fake Google key (no real requests are made). */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { planProviders } from "@/server/providers";
import { getGoogleBudget, recordUsage, currentMonth } from "@/server/providers/usage";

const settings = await prisma.userSettings.findFirst();
const user = await prisma.user.findFirstOrThrow();
const before = await prisma.userSettings.findUnique({ where: { userId: user.id } });
await prisma.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, googleMonthlyBudget: 2 }, update: { googleMonthlyBudget: 2, googleBudgetFallback: true } });
await prisma.apiUsage.deleteMany({ where: { provider: "google_places", month: currentMonth() } });
console.log("1) fresh month:", await getGoogleBudget());
console.log("   plan ->", (await planProviders()).providers.map((p) => p.key), "requestBudget", (await planProviders()).requestBudget);
await recordUsage("google_places", 2);
const plan = await planProviders();
console.log("2) after 2 requests:", await getGoogleBudget());
console.log("   plan ->", plan.providers.map((p) => p.key), "| note:", plan.note);
await prisma.userSettings.update({ where: { userId: user.id }, data: { googleBudgetFallback: false } });
try {
  await planProviders();
  console.log("3) ERROR: expected a budget error");
} catch (e) {
  console.log("3) fallback off ->", (e as Error).message);
}
// restore
await prisma.apiUsage.deleteMany({ where: { provider: "google_places", month: currentMonth() } });
await prisma.userSettings.update({ where: { userId: user.id }, data: { googleMonthlyBudget: before?.googleMonthlyBudget ?? 900, googleBudgetFallback: before?.googleBudgetFallback ?? true } });
void settings;
await prisma.$disconnect();
