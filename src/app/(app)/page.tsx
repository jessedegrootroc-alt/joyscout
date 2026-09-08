import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { EmptyState, SectionHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { OpportunityBadge, ScoreBadge } from "@/components/score";
import { StatusBadge } from "@/components/status-badge";
import { fmtDate, fmtRelative } from "@/lib/format";
import { LEAD_STATUS_LABEL, type LeadStatusKey } from "@/lib/types";
import { DEFAULT_WORKSPACE_NAME } from "@/lib/auth-guard";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const userId = user.id;
  const now = new Date();

  const [total, byStatus, recentScans, topOpportunities, followUpsDue, hotLeads] = await Promise.all([
    prisma.prospect.count({ where: { userId } }),
    prisma.prospect.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    prisma.scan.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.prospect.findMany({
      where: { userId, opportunityScore: { not: null }, status: { in: ["NEW", "QUALIFIED"] } },
      orderBy: [{ opportunityScore: "desc" }],
      take: 8,
      select: { id: true, name: true, city: true, industry: true, opportunityScore: true, websiteScore: true, googleRating: true, googleReviewCount: true, recommendedService: true, hasWebsite: true },
    }),
    prisma.prospect.findMany({
      where: { userId, followUpAt: { lte: now }, status: { notIn: ["WON", "LOST", "NOT_INTERESTED"] } },
      orderBy: { followUpAt: "asc" },
      take: 6,
      select: { id: true, name: true, followUpAt: true, status: true, city: true },
    }),
    prisma.prospect.count({ where: { userId, opportunityScore: { gte: 80 } } }),
  ]);

  const count = (s: LeadStatusKey) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const contacted = ["CONTACTED", "REPLIED", "FOLLOW_UP", "MEETING_BOOKED", "WON", "LOST", "NOT_INTERESTED"].reduce((a, s) => a + count(s as LeadStatusKey), 0);
  const replies = ["REPLIED", "MEETING_BOOKED", "WON"].reduce((a, s) => a + count(s as LeadStatusKey), 0);
  const meetings = count("MEETING_BOOKED") + count("WON");

  const stats = [
    { label: "Prospects found", value: total },
    { label: "Hot leads", value: hotLeads, hint: "opportunity ≥ 80" },
    { label: "Qualified", value: count("QUALIFIED") },
    { label: "Contacted", value: contacted },
    { label: "Replies", value: replies },
    { label: "Meetings", value: meetings },
    { label: "Clients won", value: count("WON") },
  ];

  const funnel: { key: LeadStatusKey; value: number }[] = (["NEW", "QUALIFIED", "CONTACTED", "REPLIED", "FOLLOW_UP", "MEETING_BOOKED", "WON", "LOST", "NOT_INTERESTED"] as LeadStatusKey[]).map((k) => ({ key: k, value: count(k) }));
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const firstName = user.name && user.name !== DEFAULT_WORKSPACE_NAME ? user.name.split(" ")[0] : null;

  return (
    <div className="mx-auto max-w-[1300px]">
      {/* Editorial greeting */}
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">{fmtDate(now)}</p>
          <h1 className="display text-[2.25rem] md:text-[2.75rem]">
            {greeting}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="font-hand mt-3 text-[24px] leading-none text-muted-foreground md:text-[28px]">Which businesses should you reach out to today?</p>
        </div>
        <Button asChild size="lg">
          <Link href="/find">
            <Search className="size-4" /> Find prospects
          </Link>
        </Button>
      </div>

      {/* One stats surface; the 1px grid gap over the border colour draws the dividers */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[1.25rem] border border-border bg-border sm:grid-cols-4 xl:grid-cols-7">
        {stats.map((s) => (
          <div key={s.label} className="bg-card px-5 py-5">
            <p className="eyebrow">{s.label}</p>
            <p className="mt-2 text-[2rem] leading-none font-medium tabular-nums tracking-tight">{s.value}</p>
            {s.hint && <p className="mt-1.5 text-[11px] text-muted-foreground">{s.hint}</p>}
          </div>
        ))}
        {/* filler keeps the last row aligned on 2- and 4-column layouts */}
        <div className="bg-card xl:hidden" aria-hidden="true" />
      </div>

      {total === 0 ? (
        <div className="mt-8">
          <EmptyState
            eyebrow="First scan"
            title="No prospects yet"
            description="Run your first scan to find local businesses with an underperforming website."
            action={
              <Button asChild size="lg">
                <Link href="/find">Find prospects</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="surface overflow-hidden lg:col-span-2">
            <SectionHeader
              title="Top opportunities"
              meta="best unworked leads"
              action={
                <Link href="/prospects?sort=opportunity_desc" className="link-arrow inline-flex items-center gap-1.5 text-[13px] font-medium text-brand">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            {topOpportunities.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-muted-foreground">No analysed prospects yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full min-w-[640px]">
                  <thead className="text-left">
                    <tr className="border-b border-border">
                      <th className="px-5 py-2.5">Company</th>
                      <th className="px-3 py-2.5">Google</th>
                      <th className="px-3 py-2.5">Website</th>
                      <th className="px-3 py-2.5">Opportunity</th>
                      <th className="px-5 py-2.5">Recommended</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topOpportunities.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-3">
                          <Link href={`/prospects/${p.id}`} className="font-medium hover:underline">
                            {p.name}
                          </Link>
                          <div className="text-[12.5px] text-muted-foreground">
                            {p.industry}
                            {p.city ? ` · ${p.city}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-mono text-[12px] tabular-nums text-muted-foreground">{p.googleRating != null ? `${p.googleRating.toFixed(1)} ★ (${p.googleReviewCount ?? 0})` : "—"}</td>
                        <td className="px-3 py-3">{p.hasWebsite ? <ScoreBadge score={p.websiteScore} /> : <span className="text-[12.5px] text-muted-foreground">No website</span>}</td>
                        <td className="px-3 py-3">
                          <OpportunityBadge score={p.opportunityScore} />
                        </td>
                        <td className="px-5 py-3 text-[13px] text-muted-foreground">{p.recommendedService ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="surface overflow-hidden">
            <SectionHeader
              title="Follow-ups due"
              action={
                <Link href="/follow-ups" className="link-arrow inline-flex items-center gap-1.5 text-[13px] font-medium text-brand">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            {followUpsDue.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-muted-foreground">Nothing due. Enjoy the quiet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {followUpsDue.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <Link href={`/prospects/${p.id}`} className="block truncate font-medium hover:underline">
                        {p.name}
                      </Link>
                      <div className="text-[12.5px] text-muted-foreground">Due {fmtRelative(p.followUpAt)}</div>
                    </div>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface overflow-hidden lg:col-span-2">
            <SectionHeader
              title="Recent scrapes"
              action={
                <Link href="/scans" className="link-arrow inline-flex items-center gap-1.5 text-[13px] font-medium text-brand">
                  View all <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            <ul className="divide-y divide-border">
              {recentScans.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link href={`/scans/${s.id}`} className="block truncate font-medium hover:underline">
                      {s.name}
                    </Link>
                    <div className="text-[12.5px] text-muted-foreground">
                      {s.totalFound} prospects · {fmtDate(s.createdAt)}
                    </div>
                  </div>
                  <span className="eyebrow">{s.status === "RUNNING" ? s.stage : s.status.toLowerCase()}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface overflow-hidden">
            <SectionHeader title="Lead funnel" />
            <ul className="space-y-2.5 px-5 py-4">
              {funnel.map((f) => (
                <li key={f.key} className="grid grid-cols-[112px_1fr_36px] items-center gap-3 text-[12.5px]">
                  <span className="truncate text-muted-foreground">{LEAD_STATUS_LABEL[f.key]}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-foreground/8">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-(--ease-spring)" style={{ width: `${(f.value / funnelMax) * 100}%` }} />
                  </div>
                  <span className="text-right font-mono tabular-nums">{f.value}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
