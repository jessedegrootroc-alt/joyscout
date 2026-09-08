"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pause, Play, RefreshCw, Trash2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/page-header";
import { fmtDate, fmtRelative } from "@/lib/format";

type RadarDTO = {
  id: string;
  name: string;
  query: string;
  location: string;
  countryCode: string;
  radiusKm: number;
  maxResults: number;
  frequency: string;
  isActive: boolean;
  filters: { minOpportunityScore?: number; maxWebsiteScore?: number; minReviews?: number };
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  newProspectsTotal: number;
  list: { id: string; name: string; _count: { prospects: number } };
  scans: { id: string; status: string; stage: string; totalNew: number; totalFound: number; createdAt: string }[];
};

const FREQ: Record<string, string> = { DAILY: "Daily", WEEKLY: "Weekly", BIWEEKLY: "Every two weeks", MONTHLY: "Monthly" };

export function RadarList({ radars }: { radars: RadarDTO[] }) {
  const router = useRouter();
  async function act(id: string, action: string) {
    const res = await fetch(`/api/radars/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? "Failed");
    toast.success(d.message ?? "Updated");
    router.refresh();
  }
  async function remove(id: string, name: string) {
    if (!confirm(`Delete radar “${name}”? The list and its prospects are kept.`)) return;
    await fetch(`/api/radars/${id}`, { method: "DELETE" });
    toast.success("Radar deleted");
    router.refresh();
  }
  if (radars.length === 0) return <EmptyState title="No radars yet" description="Add a radar to automatically find new prospects every week." />;
  return (
    <div className="space-y-4">
      {radars.map((r) => {
        const last = r.scans[0];
        const f = r.filters ?? {};
        return (
          <div key={r.id} className="surface p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[17px] font-medium tracking-tight">{r.name}</h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${r.isActive ? "bg-tint-green/28 text-[#1b6a3a]" : "bg-foreground/6 text-muted-foreground"}`}>{r.isActive ? "Active" : "Paused"}</span>
                  <span className="eyebrow">{r.countryCode}</span>
                </div>
                <div className="mt-1.5 text-[13px] text-muted-foreground">
                  {r.query} · {r.location} · {r.radiusKm} km · {FREQ[r.frequency]} · up to {r.maxResults} businesses/scan
                  {f.minOpportunityScore != null ? ` · Opportunity ≥ ${f.minOpportunityScore}` : ""}
                  {f.maxWebsiteScore != null ? ` · Website Score ≤ ${f.maxWebsiteScore}` : ""}
                  {f.minReviews != null ? ` · reviews ≥ ${f.minReviews}` : ""}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">
                  <span>
                    Last scan: <b>{r.lastRunAt ? fmtRelative(r.lastRunAt) : "never"}</b>
                    {last ? ` (${last.status === "RUNNING" ? last.stage : last.status.toLowerCase()}, ${last.totalNew} new of ${last.totalFound})` : ""}
                  </span>
                  <span>
                    Next: <b>{r.isActive && r.nextRunAt ? fmtDate(r.nextRunAt, true) : "—"}</b>
                  </span>
                  <span>
                    Runs: <b>{r.runCount}</b>
                  </span>
                  <span>
                    New prospects total: <b>{r.newProspectsTotal}</b>
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/lists/${r.list.id}`}>
                    <ListChecks className="size-3.5" /> {r.list.name} ({r.list._count.prospects})
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => act(r.id, "run_now")}>
                  <RefreshCw className="size-3.5" /> Scan now
                </Button>
                <Button variant="ghost" size="sm" onClick={() => act(r.id, r.isActive ? "pause" : "resume")}>
                  {r.isActive ? <Pause className="size-3.5" /> : <Play className="size-3.5" />} {r.isActive ? "Pause" : "Resume"}
                </Button>
                <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => remove(r.id, r.name)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            {last && (
              <div className="mt-3 text-[12.5px] text-muted-foreground">
                Latest scan:{" "}
                <Link href={`/scans/${last.id}`} className="underline underline-offset-2 hover:text-foreground">
                  {fmtDate(last.createdAt, true)}
                </Link>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
