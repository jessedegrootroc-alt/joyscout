import { env } from "@/lib/env";
import { LEAD_STATUS_LABEL, type LeadStatusKey } from "@/lib/types";

/**
 * Follow-up reminder email in the Joyscrape house style: cream page, white card,
 * the wordmark, an eyebrow, one clear headline and a single black CTA. Table-based
 * with inline styles so it renders the same in Gmail, Outlook and Apple Mail.
 */
export type ReminderInput = {
  prospect: { id: string; name: string; city: string | null; status: string; opportunityScore: number | null; contactedAt: Date | null; followUpAt: Date | null; website: string | null };
  lastNote: string | null;
  followUpIndex: number | null;
  language: "nl" | "en";
  recipientName?: string | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fmt(d: Date | null, lang: "nl" | "en") {
  if (!d) return "";
  return d.toLocaleDateString(lang === "nl" ? "nl-NL" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysAgo(d: Date | null) {
  if (!d) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}

const T = {
  nl: {
    eyebrow: "Opvolging vandaag",
    subject: (n: string) => `Vandaag opvolgen: ${n}`,
    headline: (n: string) => `Tijd om ${n} een bericht te sturen.`,
    intro: (n: string, ago: number | null) => (ago == null ? `Je opvolgdatum voor ${n} is vandaag.` : `Je hebt ${n} ${ago === 0 ? "vandaag" : ago === 1 ? "gisteren" : `${ago} dagen geleden`} benaderd en er is nog geen reactie geregistreerd.`),
    ready: (i: number | null) => (i ? `Opvolgbericht ${i} staat al voor je klaar; alleen nog kopiëren en versturen.` : "Het opvolgbericht staat al voor je uitgeschreven; alleen nog kopiëren en versturen."),
    cta: "Open het opvolgbericht",
    contacted: "Benaderd",
    followUp: "Opvolgdatum",
    note: "Laatste notitie",
    opportunity: "Opportunity",
    footer: "Je ontvangt deze herinnering omdat je een opvolgdatum hebt ingesteld in Joyscrape.",
    settings: "Instellingen",
    open: "Open prospect",
  },
  en: {
    eyebrow: "Follow-up due",
    subject: (n: string) => `Follow up today: ${n}`,
    headline: (n: string) => `Time to send ${n} a message.`,
    intro: (n: string, ago: number | null) => (ago == null ? `Your follow-up date for ${n} is today.` : `You reached out to ${n} ${ago === 0 ? "today" : ago === 1 ? "yesterday" : `${ago} days ago`} and no reply has been logged yet.`),
    ready: (i: number | null) => (i ? `Follow-up ${i} is already written for you; copy it and send.` : "Your follow-up message is already written; copy it and send."),
    cta: "Open the follow-up message",
    contacted: "Contacted",
    followUp: "Follow-up date",
    note: "Last note",
    opportunity: "Opportunity",
    footer: "You receive this reminder because you set a follow-up date in Joyscrape.",
    settings: "Settings",
    open: "Open prospect",
  },
};

export function buildFollowUpReminder(input: ReminderInput): { subject: string; html: string; text: string } {
  const t = T[input.language];
  const p = input.prospect;
  const base = env.appUrl.replace(/\/$/, "");
  const link = `${base}/follow-ups/${p.id}`;
  const prospectLink = `${base}/prospects/${p.id}`;
  const ago = daysAgo(p.contactedAt);
  const status = LEAD_STATUS_LABEL[p.status as LeadStatusKey] ?? p.status;
  const meta = [p.city, p.contactedAt ? `${t.contacted.toLowerCase()} ${fmt(p.contactedAt, input.language)}` : null].filter(Boolean).join(" · ");

  const pill = (label: string, bg: string, fg: string) => `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${bg};color:${fg};font:500 12px/16px Helvetica,Arial,sans-serif">${esc(label)}</span>`;

  const html = `<!doctype html>
<html lang="${input.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(t.subject(p.name))}</title></head>
<body style="margin:0;padding:0;background:#f3efea;-webkit-font-smoothing:antialiased">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3efea"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px">
  <tr><td style="padding:0 8px 22px;font:700 24px/1 Helvetica,Arial,sans-serif;letter-spacing:-0.04em;color:#1a1a1a">Joyscrap<span style="color:#ff864a">e</span></td></tr>
  <tr><td style="background:#ffffff;border:1px solid #e8dfd5;border-radius:24px;padding:34px 36px">
    <p style="margin:0 0 14px;font:500 11px/1 'Courier New',monospace;letter-spacing:0.12em;text-transform:uppercase;color:#6a6866">${esc(t.eyebrow)}</p>
    <h1 style="margin:0 0 14px;font:600 28px/1.15 Helvetica,Arial,sans-serif;letter-spacing:-0.02em;color:#1a1a1a">${esc(t.headline(p.name))}</h1>
    <p style="margin:0 0 8px;font:400 15px/1.55 Helvetica,Arial,sans-serif;color:#323232">${esc(t.intro(p.name, ago))}</p>
    <p style="margin:0 0 26px;font:400 15px/1.55 Helvetica,Arial,sans-serif;color:#323232">${esc(t.ready(input.followUpIndex))}</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e8dfd5;border-radius:16px"><tr>
      <td style="padding:16px 18px">
        <div style="font:500 16px/1.3 Helvetica,Arial,sans-serif;color:#1a1a1a">${esc(p.name)}</div>
        ${meta ? `<div style="margin-top:4px;font:400 13px/1.4 Helvetica,Arial,sans-serif;color:#6a6866">${esc(meta)}</div>` : ""}
        ${input.lastNote ? `<div style="margin-top:6px;font:400 13px/1.4 Helvetica,Arial,sans-serif;color:#6a6866">“${esc(input.lastNote.slice(0, 120))}${input.lastNote.length > 120 ? "…" : ""}”</div>` : ""}
        <div style="margin-top:12px">
          ${pill(status, "#dfeaff", "#1f4fa8")}
          ${p.opportunityScore != null ? `&nbsp;${pill(`${t.opportunity} ${p.opportunityScore}`, "#eef3ff", "#2a66d4")}` : ""}
          ${p.followUpAt ? `&nbsp;<span style="font:400 12px/16px 'Courier New',monospace;color:#6a6866">${esc(t.followUp)}: ${esc(fmt(p.followUpAt, input.language))}</span>` : ""}
        </div>
      </td></tr></table>

    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0 6px"><tr>
      <td style="border-radius:999px;background:#1a1a1a"><a href="${link}" style="display:inline-block;padding:14px 22px;font:500 15px/1 Helvetica,Arial,sans-serif;color:#f3efea;text-decoration:none;border-radius:999px">${esc(t.cta)} →</a></td>
      <td style="padding-left:14px"><a href="${prospectLink}" style="font:500 14px/1 Helvetica,Arial,sans-serif;color:#2a66d4;text-decoration:none">${esc(t.open)}</a></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:18px 8px 0;font:400 12px/1.5 Helvetica,Arial,sans-serif;color:#6a6866">${esc(t.footer)} <a href="${base}/settings" style="color:#6a6866">${esc(t.settings)}</a></td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [t.headline(p.name), "", t.intro(p.name, ago), t.ready(input.followUpIndex), "", `${p.name}${meta ? ` · ${meta}` : ""}`, input.lastNote ? `${t.note}: ${input.lastNote}` : null, "", `${t.cta}: ${link}`, `${t.open}: ${prospectLink}`, "", t.footer].filter((l) => l !== null).join("\n");

  return { subject: t.subject(p.name), html, text };
}
