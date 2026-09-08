import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { OpportunityBadge } from "@/components/score";
import { fmtDate, fmtRelative } from "@/lib/format";
import { FollowUpActions } from "@/components/follow-up-actions";

export const metadata = { title: "Follow-ups" };

export default async function FollowUpsPage() {
  const user = await requireUser();
  const now = new Date();
  const items = await prisma.prospect.findMany({
    where: { userId: user.id, followUpAt: { not: null }, status: { notIn: ["WON", "LOST", "NOT_INTERESTED"] } },
    orderBy: { followUpAt: "asc" },
    take: 300,
    select: { id: true, name: true, city: true, status: true, opportunityScore: true, followUpAt: true, contactedAt: true, email: true, phone: true, outreach: { where: { isFollowUp: true }, orderBy: { followUpIndex: "asc" }, select: { id: true, followUpIndex: true, followUpAfterDays: true, subject: true, body: true } }, notes: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } } },
  });
  const due = items.filter((i) => i.followUpAt! <= now);
  const upcoming = items.filter((i) => i.followUpAt! > now);

  const renderSection = (title: string, rows: typeof items, tone: "due" | "upcoming") => (
    <section className="surface overflow-hidden">
      <header className="flex items-baseline gap-2 border-b border-border px-5 py-3">
        <h2 className="text-[15px] font-medium">{title}</h2>
        <span className="font-mono text-[12px] text-muted-foreground">{rows.length}</span>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-[14px] text-muted-foreground">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((p) => {
            const daysSince = p.contactedAt ? Math.round((now.getTime() - p.contactedAt.getTime()) / 86400000) : null;
            const suggested = p.outreach.find((o) => daysSince != null && (o.followUpAfterDays ?? 0) <= daysSince) ?? p.outreach[0];
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13.5px]">
                <div className="min-w-[220px] flex-1">
                  <Link href={`/prospects/${p.id}`} className="text-[14px] font-medium hover:underline">
                    {p.name}
                  </Link>
                  <div className="text-[12.5px] text-muted-foreground">
                    {p.city ? `${p.city} · ` : ""}
                    {p.contactedAt ? `contacted ${fmtDate(p.contactedAt)} (${daysSince}d ago)` : "not contacted yet"}
                    {p.notes[0] ? ` · “${p.notes[0].body.slice(0, 60)}${p.notes[0].body.length > 60 ? "…" : ""}”` : ""}
                  </div>
                </div>
                <StatusBadge status={p.status} />
                <OpportunityBadge score={p.opportunityScore} />
                <span className={`w-[120px] font-mono text-[12px] ${tone === "due" ? "font-medium text-[#8a3d12]" : "text-muted-foreground"}`}>
                  {tone === "due" ? `Due ${fmtRelative(p.followUpAt)}` : fmtDate(p.followUpAt)}
                </span>
                <FollowUpActions prospectId={p.id} suggested={suggested ? { index: suggested.followUpIndex ?? 1, text: suggested.subject ? `Subject: ${suggested.subject}\n\n${suggested.body}` : suggested.body } : null} hasFollowUps={p.outreach.length > 0} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow="Pipeline" title="Follow-ups" description="Prospects with a scheduled follow-up. Generated follow-up messages are one click away." />
      {items.length === 0 ? (
        <EmptyState title="No follow-ups scheduled" description="Set a follow-up date on a prospect (detail page → Lead management) and it shows up here." />
      ) : (
        <div className="space-y-5">
          {renderSection("Due now", due, "due")}
          {renderSection("Upcoming", upcoming, "upcoming")}
        </div>
      )}
    </div>
  );
}
