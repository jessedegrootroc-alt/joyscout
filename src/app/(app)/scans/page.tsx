import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { ScanRowActions } from "@/components/scan-row-actions";

export const metadata = { title: "Scrapes" };

export default async function ScansPage() {
  const user = await requireUser();
  const scans = await prisma.scan.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="History"
        title="Scrapes"
        description="Every scan you have run. Open one to see its prospects again."
        actions={
          <Button asChild size="sm">
            <Link href="/find">New scan</Link>
          </Button>
        }
      />
      {scans.length === 0 ? (
        <EmptyState title="No scans yet" description="Start with Find Prospects." />
      ) : (
        <div className="overflow-x-auto rounded-[1.25rem] border border-border bg-card">
          <table className="data-table w-full min-w-[760px] text-[13.5px]">
            <thead className="text-left">
              <tr className="border-b border-border">
                <th className="px-5 py-3">Scan</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3 text-right">Prospects</th>
                <th className="px-3 py-3 text-right">New</th>
                <th className="px-3 py-3 text-right">Analysed</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scans.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3">
                    <Link href={`/scans/${s.id}`} className="text-[14px] font-medium hover:underline">
                      {s.name}
                    </Link>
                    <div className="text-[12.5px] text-muted-foreground">
                      {s.query} · {s.radiusKm} km · {s.providers.join(", ") || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-3">{s.location}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12.5px] tabular-nums">{s.totalFound}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12.5px] tabular-nums text-muted-foreground">{s.totalNew}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12.5px] tabular-nums text-muted-foreground">
                    {s.analyzedCount}
                    {s.failedCount ? <span className="text-destructive"> ({s.failedCount} failed)</span> : null}
                  </td>
                  <td className="px-3 py-3">
                    <ScanStatus status={s.status} stage={s.stage} />
                  </td>
                  <td className="px-3 py-3 text-[12.5px] text-muted-foreground">{fmtDate(s.createdAt, true)}</td>
                  <td className="px-3 py-3 text-right">
                    <ScanRowActions id={s.id} status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ScanStatus({ status, stage }: { status: string; stage: string }) {
  const map: Record<string, string> = {
    QUEUED: "bg-foreground/6 text-muted-foreground",
    RUNNING: "bg-tint-blue/18 text-[#153a75]",
    COMPLETED: "bg-tint-green/28 text-[#1b6a3a]",
    FAILED: "bg-destructive/12 text-destructive",
    CANCELLED: "bg-foreground/6 text-muted-foreground",
  };
  return (
    <span className={`inline-flex h-6 max-w-[260px] items-center truncate rounded-full px-2.5 text-[12px] font-medium ${map[status] ?? "bg-foreground/6"}`}>
      {status === "RUNNING" ? stage : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
