"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle, Search, Globe, ScanSearch, ListChecks, Calculator } from "lucide-react";
import { toast } from "sonner";
import type { ProspectRowDTO } from "@/server/prospects/query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ProspectTable } from "@/components/prospect-table";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type ScanDTO = {
  id: string;
  name: string;
  query: string;
  location: string;
  radiusKm: number;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  stage: string;
  error: string | null;
  providers: string[];
  providerNote?: string | null;
  totalFound: number;
  totalNew: number;
  totalDuplicates: number;
  analyzedCount: number;
  failedCount: number;
  noWebsiteCount: number;
  createdAt: string;
  completedAt: string | null;
  filters: { maxWebsiteScore?: number; minOpportunityScore?: number } | null;
};

const STAGES = [
  { key: "Searching businesses", icon: Search },
  { key: "Finding websites", icon: Globe },
  { key: "Analyzing websites", icon: ScanSearch },
  { key: "Running SEO checks", icon: ListChecks },
  { key: "Calculating scores", icon: Calculator },
];

export function ScanLiveView({
  initialScan,
  initialRows,
  lists,
}: {
  initialScan: ScanDTO;
  initialRows: ProspectRowDTO[];
  lists: { id: string; name: string }[];
}) {
  const [scan, setScan] = useState(initialScan);
  const [rows, setRows] = useState(initialRows);
  const [applyFilters, setApplyFilters] = useState(true);
  const active = scan.status === "QUEUED" || scan.status === "RUNNING";

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/scans/${scan.id}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!stopped) {
            setScan(data.scan);
            setRows(data.rows);
          }
        }
      } catch {
        /* network hiccup, retry next tick */
      }
    };
    const iv = setInterval(tick, 2000);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, [active, scan.id]);

  const stageIndex = useMemo(() => {
    if (scan.status === "COMPLETED") return STAGES.length;
    const i = STAGES.findIndex((s) => s.key === scan.stage);
    return i === -1 ? 0 : i;
  }, [scan.stage, scan.status]);

  const done = scan.analyzedCount + scan.failedCount + scan.noWebsiteCount;
  const pct = scan.totalFound ? Math.min(100, Math.round((done / scan.totalFound) * 100)) : scan.status === "COMPLETED" ? 100 : 5;

  const visibleRows = useMemo(() => {
    if (!applyFilters) return rows;
    const f = scan.filters ?? {};
    return rows.filter((r) => {
      if (f.maxWebsiteScore != null && r.hasWebsite && r.websiteScore != null && r.websiteScore > f.maxWebsiteScore) return false;
      if (f.minOpportunityScore != null && r.opportunityScore != null && r.opportunityScore < f.minOpportunityScore) return false;
      return true;
    });
  }, [rows, applyFilters, scan.filters]);
  const hasResultFilters = scan.filters?.maxWebsiteScore != null || scan.filters?.minOpportunityScore != null;

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        title={scan.name}
        description={
          <>
            {scan.query} · {scan.location} · {scan.radiusKm} km · {fmtDate(scan.createdAt, true)}
            {scan.providers.length ? ` · via ${scan.providers.map((p) => (p === "google_places" ? "Google Places" : p === "overpass" ? "OpenStreetMap" : p)).join(", ")}` : ""}
          </>
        }
        actions={
          <>
            {active && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await fetch(`/api/scans/${scan.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
                  toast.success("Scan cancelled");
                  setScan((s) => ({ ...s, status: "CANCELLED", stage: "Cancelled" }));
                }}
              >
                Cancel scan
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link href={`/prospects?scanId=${scan.id}`}>Open in Prospects</Link>
            </Button>
          </>
        }
      />

      <section className="mb-6 rounded-[1.5rem] border border-border bg-card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[17px] font-medium tracking-tight">
            {active ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : scan.status === "COMPLETED" ? <CheckCircle2 className="size-5 text-[#1b6a3a]" /> : <XCircle className="size-5 text-destructive" />}
            {active ? scan.stage : scan.status === "COMPLETED" ? "Scan completed" : scan.status === "CANCELLED" ? "Scan cancelled" : "Scan failed"}
            {scan.error && <span className="text-[13px] font-normal text-destructive">— {scan.error}</span>}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-muted-foreground tabular-nums">
            <span>
              <b className="text-foreground">{scan.totalFound}</b> businesses found
            </span>
            <span>
              <b className="text-foreground">{scan.totalNew}</b> new
            </span>
            <span>
              <b className="text-foreground">{scan.totalDuplicates}</b> already known
            </span>
            <span>
              <b className="text-foreground">{scan.analyzedCount}</b> analysed
            </span>
            <span>
              <b className="text-foreground">{scan.noWebsiteCount}</b> without website
            </span>
            {scan.failedCount > 0 && (
              <span className="text-destructive">
                <b>{scan.failedCount}</b> failed
              </span>
            )}
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-foreground/8">
          <div className={cn("h-full rounded-full transition-[width] duration-700 ease-(--ease-spring)", scan.status === "FAILED" ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        <ol className="mt-4 flex flex-wrap gap-2">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const state = i < stageIndex ? "done" : i === stageIndex && active ? "active" : "todo";
            return (
              <li key={s.key} className={cn("inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[12.5px] transition-colors", state === "done" && "border-transparent bg-tint-green/25 text-[#1b6a3a]", state === "active" && "border-primary bg-primary font-medium text-primary-foreground", state === "todo" && "border-border text-muted-foreground")}>
                {state === "active" ? <Loader2 className="size-3.5 animate-spin" /> : state === "done" ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
                {s.key}
              </li>
            );
          })}
        </ol>
        {scan.providerNote && <p className="mt-3 rounded-xl bg-tint-yellow/22 px-3.5 py-2 text-[13px]">{scan.providerNote}</p>}
        {active && <p className="mt-3 text-[13px] text-muted-foreground">You can leave this page. Results are saved and appear under Scrapes when ready.</p>}
      </section>

      {hasResultFilters && (
        <div className="mb-3 flex items-center gap-2 text-[13px] text-muted-foreground">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={applyFilters} onChange={(e) => setApplyFilters(e.target.checked)} className="size-4 accent-[#1a1a1a]" />
            Apply scan filters
            {scan.filters?.maxWebsiteScore != null && ` (Website Score < ${scan.filters.maxWebsiteScore})`}
            {scan.filters?.minOpportunityScore != null && ` (Opportunity > ${scan.filters.minOpportunityScore})`}
          </label>
          <span>· showing {visibleRows.length} of {rows.length}</span>
        </div>
      )}

      <ProspectTable rows={visibleRows} lists={lists} total={visibleRows.length} live={active} />
    </div>
  );
}
