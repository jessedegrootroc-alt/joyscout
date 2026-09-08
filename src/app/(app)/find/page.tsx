import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { integrationStatus } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { FindProspectsForm } from "@/components/find-prospects-form";
import { getGoogleBudget } from "@/server/providers/usage";

export const metadata = { title: "Find Prospects" };

export default async function FindPage(props: PageProps<"/find">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const savedId = typeof sp.saved === "string" ? sp.saved : undefined;
  const saved = savedId ? await prisma.savedSearch.findFirst({ where: { id: savedId, userId: user.id } }) : null;
  const status = integrationStatus();
  const budget = status.googlePlaces ? await getGoogleBudget() : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="New scan" title="Find prospects" description="Tell us who you are looking for. We find the businesses, load every website and score the opportunity." />
      <FindProspectsForm
        defaultCountry={settings?.defaultCountry ?? "NL"}
        providers={{ googlePlaces: status.googlePlaces, pagespeed: status.pagespeed, ai: status.ai }}
        budget={budget ? { used: budget.used, budget: budget.budget, remaining: budget.remaining, fallback: budget.fallback, resetsInDays: budget.resetsInDays } : null}
        preset={saved ? { ...(saved.params as object), savedSearchId: saved.id, name: saved.name } : undefined}
      />
    </div>
  );
}
