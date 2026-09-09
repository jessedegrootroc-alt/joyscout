import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, Globe } from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { OpportunityBadge } from "@/components/score";
import { CopyButton } from "@/components/copy-button";
import { FollowUpActions } from "@/components/follow-up-actions";
import { fmtDate } from "@/lib/format";
import { buildTemplateFollowUp } from "@/server/outreach-template";
import { integrationStatus } from "@/lib/env";

export const metadata = { title: "Follow-up" };

/** Landing page for the reminder email: the follow-up message, written out and ready to copy. */
export default async function FollowUpPage(props: PageProps<"/follow-ups/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const [p, settings] = await Promise.all([
    prisma.prospect.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true, name: true, city: true, website: true, email: true, phone: true, status: true, opportunityScore: true, contactedAt: true, followUpAt: true, recommendedService: true,
        notes: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true, body: true, createdAt: true } },
        outreach: { orderBy: [{ isFollowUp: "asc" }, { followUpIndex: "asc" }, { createdAt: "desc" }], select: { id: true, isFollowUp: true, followUpIndex: true, followUpAfterDays: true, subject: true, body: true, channel: true } },
      },
    }),
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
  ]);
  if (!p) notFound();

  const now = new Date();
  const daysSince = p.contactedAt ? Math.round((now.getTime() - p.contactedAt.getTime()) / 86_400_000) : null;
  const followUps = p.outreach.filter((o) => o.isFollowUp);
  const original = p.outreach.find((o) => !o.isFollowUp) ?? null;
  const generated = followUps.filter((o) => daysSince != null && (o.followUpAfterDays ?? 0) <= daysSince).pop() ?? followUps[0] ?? null;
  const templateIndex = (Math.min(3, Math.max(1, daysSince == null ? 1 : daysSince >= 14 ? 3 : daysSince >= 7 ? 2 : 1)) as 1 | 2 | 3);
  const template = generated ? null : buildTemplateFollowUp(p, settings, templateIndex);
  const message = generated ? { subject: generated.subject, body: generated.body, label: `Follow-up ${generated.followUpIndex}`, source: "generated" as const } : { subject: template!.subject, body: template!.body, label: `Follow-up ${templateIndex}`, source: "template" as const };
  const copyText = message.subject ? `Subject: ${message.subject}\n\n${message.body}` : message.body;
  const ai = integrationStatus().ai;

  return (
    <div className="mx-auto max-w-[900px]">
      <Link href="/follow-ups" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Follow-ups
      </Link>
      <PageHeader
        eyebrow="Follow-up due"
        title={`Send ${p.name} a message`}
        description={
          <>
            {p.city ? `${p.city} · ` : ""}
            {p.contactedAt ? `contacted ${fmtDate(p.contactedAt)}${daysSince != null ? ` (${daysSince}d ago)` : ""}` : "not contacted yet"}
            {p.followUpAt ? ` · follow-up ${fmtDate(p.followUpAt)}` : ""}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={p.status} />
            <OpportunityBadge score={p.opportunityScore} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="surface overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
            <div className="flex items-center gap-2 text-[14px]">
              <span className="font-medium">{message.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${message.source === "generated" ? "bg-tint-blue/15 text-brand-ink" : "bg-tint-yellow/25 text-[#7a5a00]"}`}>{message.source === "generated" ? "AI-generated" : "Template"}</span>
            </div>
            <CopyButton text={copyText} />
          </header>
          <div className="px-5 py-5 text-[14.5px] leading-relaxed">
            {message.subject && (
              <p className="mb-3">
                <span className="eyebrow mr-2">Subject</span>
                <span className="font-medium">{message.subject}</span>
              </p>
            )}
            <pre className="whitespace-pre-wrap font-sans">{message.body}</pre>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-[12.5px] text-muted-foreground">
            <span>
              {message.source === "template"
                ? ai
                  ? original
                    ? "Generate AI follow-ups from the Outreach tab for a message that uses the audit findings."
                    : "Generate outreach from the Outreach tab first to get AI follow-ups based on the audit."
                  : "Template text: add an AI key in Settings for follow-ups based on the website audit."
                : "Written from the audit findings and your original outreach."}
            </span>
            <FollowUpActions prospectId={p.id} suggested={{ index: generated?.followUpIndex ?? templateIndex, text: copyText }} hasFollowUps={followUps.length > 0} />
          </footer>
        </section>

        <aside className="space-y-4">
          <section className="surface p-5 text-[13.5px]">
            <h2 className="mb-3 text-[15px] font-medium">Contact</h2>
            <ul className="space-y-2">
              {p.email ? (
                <li className="flex items-center gap-2"><Mail className="size-3.5 text-muted-foreground" /><a href={`mailto:${p.email}?subject=${encodeURIComponent(message.subject ?? "")}&body=${encodeURIComponent(message.body)}`} className="truncate hover:underline">{p.email}</a></li>
              ) : null}
              {p.phone ? <li className="flex items-center gap-2"><Phone className="size-3.5 text-muted-foreground" /><a href={`tel:${p.phone}`} className="hover:underline">{p.phone}</a></li> : null}
              {p.website ? <li className="flex items-center gap-2"><Globe className="size-3.5 text-muted-foreground" /><a href={p.website} target="_blank" rel="noreferrer" className="truncate hover:underline">{p.website.replace(/^https?:\/\//, "")}</a></li> : null}
              {!p.email && !p.phone && !p.website && <li className="text-muted-foreground">No contact details found.</li>}
            </ul>
            <Link href={`/prospects/${p.id}?tab=outreach`} className="mt-4 inline-flex text-[13px] font-medium text-brand-ink hover:underline">Open prospect →</Link>
          </section>
          <section className="surface p-5 text-[13.5px]">
            <h2 className="mb-3 text-[15px] font-medium">Notes</h2>
            {p.notes.length === 0 ? <p className="text-muted-foreground">No notes yet.</p> : (
              <ul className="space-y-2.5">
                {p.notes.map((n) => (
                  <li key={n.id}>
                    <div className="font-mono text-[11px] text-muted-foreground">{fmtDate(n.createdAt)}</div>
                    <div>{n.body}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
