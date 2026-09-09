import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { OpportunityBadge } from "@/components/score";
import { fmtDate } from "@/lib/format";
import { CopyButton } from "@/components/copy-button";

export const metadata = { title: "Outreach" };

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", LINKEDIN: "LinkedIn", WHATSAPP: "WhatsApp", PHONE: "Phone", INSTAGRAM: "Instagram" };

export default async function OutreachPage(props: PageProps<"/outreach">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const channel = typeof sp.channel === "string" ? sp.channel : undefined;
  const view = sp.view === "contacted" ? "contacted" : "messages";
  // Prospects you have reached out to, whether or not a message was generated in the app.
  const PIPELINE = ["CONTACTED", "REPLIED", "FOLLOW_UP", "MEETING_BOOKED"] as const;
  const contacted = await prisma.prospect.findMany({
    where: { userId: user.id, OR: [{ contactedAt: { not: null } }, { status: { in: [...PIPELINE] } }] },
    orderBy: [{ contactedAt: { sort: "desc", nulls: "last" } }, { updatedAt: "desc" }],
    take: 300,
    select: { id: true, name: true, city: true, status: true, opportunityScore: true, email: true, phone: true, contactedAt: true, followUpAt: true, _count: { select: { outreach: true } }, notes: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } } },
  });
  const messages = await prisma.outreachMessage.findMany({
    where: { userId: user.id, isFollowUp: false, ...(channel ? { channel: channel as never } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { prospect: { select: { id: true, name: true, city: true, status: true, opportunityScore: true, email: true, phone: true, contactedAt: true } }, _count: { select: { followUps: true } } },
  });
  const counts = await prisma.outreachMessage.groupBy({ by: ["channel"], where: { userId: user.id, isFollowUp: false }, _count: { _all: true } });

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow="Messages" title="Outreach" description="Every generated message, newest first, plus the prospects you have marked as contacted." />
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
        <Link href="/outreach" className={`rounded-full border px-3.5 py-1.5 font-medium transition-colors ${view === "messages" && !channel ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-foreground/5"}`}>
          Messages ({counts.reduce((a, c) => a + c._count._all, 0)})
        </Link>
        {counts.map((c) => (
          <Link key={c.channel} href={`/outreach?channel=${c.channel}`} className={`rounded-full border px-3.5 py-1.5 font-medium transition-colors ${view === "messages" && channel === c.channel ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-foreground/5"}`}>
            {CHANNEL_LABEL[c.channel]} ({c._count._all})
          </Link>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />
        <Link href="/outreach?view=contacted" className={`rounded-full border px-3.5 py-1.5 font-medium transition-colors ${view === "contacted" ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-foreground/5"}`}>
          Contacted prospects ({contacted.length})
        </Link>
      </div>
      {view === "contacted" ? (
        contacted.length === 0 ? (
          <EmptyState title="Nobody contacted yet" description="Use “Mark contacted” on a prospect, or set its status to Contacted, and it shows up here with its contact date and follow-up." />
        ) : (
          <section className="surface overflow-hidden">
            <ul className="divide-y divide-border">
              {contacted.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13.5px]">
                  <div className="min-w-[220px] flex-1">
                    <Link href={`/prospects/${p.id}`} className="text-[14px] font-medium hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-[12.5px] text-muted-foreground">
                      {p.city ? `${p.city} · ` : ""}
                      {p.contactedAt ? `contacted ${fmtDate(p.contactedAt)}` : "no contact date"}
                      {p.followUpAt ? ` · follow-up ${fmtDate(p.followUpAt)}` : ""}
                      {p.notes[0] ? ` · “${p.notes[0].body.slice(0, 60)}${p.notes[0].body.length > 60 ? "…" : ""}”` : ""}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                  <OpportunityBadge score={p.opportunityScore} />
                  <span className="hidden w-[170px] truncate font-mono text-[11.5px] text-muted-foreground md:block">{p.email ?? p.phone ?? "No contact details"}</span>
                  <Link href={`/prospects/${p.id}?tab=outreach`} className="rounded-full border border-input px-3 py-1 text-[12.5px] font-medium transition-colors hover:bg-foreground/5">
                    {p._count.outreach ? `${p._count.outreach} message${p._count.outreach === 1 ? "" : "s"}` : "Write message"}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      ) : messages.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description={
            contacted.length
              ? `You have marked ${contacted.length} prospect${contacted.length === 1 ? "" : "s"} as contacted; see the “Contacted prospects” tab. Generate a message from a prospect's Outreach tab to keep the text here.`
              : "Open a prospect and use the Outreach tab, or select prospects and choose “Generate outreach”."
          }
        />
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <article key={m.id} className="surface overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-[13.5px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/prospects/${m.prospect.id}?tab=outreach`} className="text-[15px] font-medium hover:underline">
                    {m.prospect.name}
                  </Link>
                  {m.prospect.city && <span className="text-muted-foreground">{m.prospect.city}</span>}
                  <StatusBadge status={m.prospect.status} />
                  <OpportunityBadge score={m.prospect.opportunityScore} />
                </div>
                <div className="flex items-center gap-3 font-mono text-[11.5px] text-muted-foreground">
                  <span>
                    {CHANNEL_LABEL[m.channel]} · {m.tone} · {m.length}
                    {m._count.followUps ? ` · ${m._count.followUps} follow-ups` : ""}
                  </span>
                  <span>{fmtDate(m.createdAt, true)}</span>
                  <CopyButton text={m.subject ? `Subject: ${m.subject}\n\n${m.body}` : m.body} />
                </div>
              </header>
              <div className="px-5 py-4 text-[14px]">
                {m.subject && (
                  <div className="mb-2">
                    <span className="eyebrow mr-2">Subject</span>
                    <span className="font-medium">{m.subject}</span>
                  </div>
                )}
                <pre className="line-clamp-6 whitespace-pre-wrap font-sans leading-relaxed">{m.body}</pre>
                <div className="mt-3 text-[12.5px] text-muted-foreground">
                  {m.prospect.email ? `To: ${m.prospect.email}` : m.prospect.phone ? `Phone: ${m.prospect.phone}` : "No contact details"}
                  {m.prospect.contactedAt ? ` · contacted ${fmtDate(m.prospect.contactedAt)}` : " · not yet contacted"}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
