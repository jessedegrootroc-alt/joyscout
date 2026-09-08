import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/page-header";
import { SavedSearchActions } from "@/components/saved-search-actions";
import { fmtDate } from "@/lib/format";
import type { ScanInput } from "@/lib/types";

export const metadata = { title: "Saved searches" };

export default async function SavedSearchesPage() {
  const user = await requireUser();
  const searches = await prisma.savedSearch.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, include: { scans: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, totalFound: true, status: true } } } });
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader eyebrow="Reusable" title="Saved searches" description="Re-run a search with the same industry, location, radius and filters. Tick “Save this search” on the Find Prospects page to add one." />
      {searches.length === 0 ? (
        <EmptyState title="No saved searches" description="Save a search from Find Prospects to run it again later." />
      ) : (
        <div className="overflow-x-auto rounded-[1.25rem] border border-border bg-card">
          <table className="data-table w-full min-w-[760px] text-[13.5px]">
            <thead className="text-left">
              <tr className="border-b border-border">
                <th className="px-5 py-3">Search</th>
                <th className="px-3 py-3">Filters</th>
                <th className="px-3 py-3">Last run</th>
                <th className="px-3 py-3 text-right">Runs</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {searches.map((s) => {
                const p = s.params as ScanInput;
                const f = p.filters ?? { websiteRequired: "any" };
                const filterText = [
                  `${p.radiusKm ?? 25} km`,
                  f.minReviews != null ? `reviews ≥ ${f.minReviews}` : null,
                  f.websiteRequired && f.websiteRequired !== "any" ? (f.websiteRequired === "yes" ? "website required" : "no website only") : null,
                  f.maxWebsiteScore != null ? `Website Score < ${f.maxWebsiteScore}` : null,
                  f.minOpportunityScore != null ? `Opportunity > ${f.minOpportunityScore}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr key={s.id}>
                    <td className="px-5 py-3">
                      <div className="text-[14px] font-medium">{s.name}</div>
                      <div className="text-[12.5px] text-muted-foreground">
                        {p.query} · {p.location}, {p.countryCode} · max {p.maxResults}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[12.5px] text-muted-foreground">{filterText}</td>
                    <td className="px-3 py-3 text-[12.5px] text-muted-foreground">
                      {s.lastRunAt ? fmtDate(s.lastRunAt, true) : "never"}
                      {s.scans[0] ? ` · ${s.scans[0].totalFound} prospects` : ""}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12.5px] tabular-nums">{s.runCount}</td>
                    <td className="px-3 py-3 text-right">
                      <SavedSearchActions id={s.id} lastScanId={s.scans[0]?.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
