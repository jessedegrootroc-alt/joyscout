import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { integrationStatus } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { CheckCircle2, XCircle } from "lucide-react";
import { getGoogleBudget, getMonthUsage } from "@/server/providers/usage";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const status = integrationStatus();
  const [budget, geocodingUsed, pagespeedUsed] = await Promise.all([getGoogleBudget(), getMonthUsage("google_geocoding"), getMonthUsage("pagespeed")]);
  const rows = [
    { label: "Google Places API", ok: status.googlePlaces, env: "GOOGLE_PLACES_API_KEY", note: status.googlePlaces ? "Business discovery with ratings and reviews." : "Falls back to OpenStreetMap (no ratings/reviews, fewer results)." },
    { label: "PageSpeed Insights", ok: status.pagespeed, env: "PAGESPEED_API_KEY", note: status.pagespeed ? "Mobile + desktop Lighthouse runs." : "Works without a key at a very low quota; desktop run skipped." },
    { label: `AI analysis & outreach${status.aiProvider ? ` (${status.aiProvider})` : ""}`, ok: status.ai, env: "ANTHROPIC_API_KEY or OPENAI_API_KEY", note: status.ai ? "Qualitative analysis, outreach and follow-ups enabled." : "AI analysis, outreach generation and follow-ups are disabled." },
    { label: "Screenshot storage (Vercel Blob)", ok: status.blob, env: "BLOB_READ_WRITE_TOKEN", note: status.blob ? "Screenshots are stored in Vercel Blob and load from any deployment." : "Screenshots are written to STORAGE_DIR on the worker machine; the web app must run on the same machine to show them." },
    { label: `Email reminders${status.mailTransport ? ` (${status.mailTransport})` : ""}`, ok: status.mail, env: "RESEND_API_KEY or SMTP_HOST, plus MAIL_FROM", note: status.mail ? "Follow-up reminders are emailed when a follow-up date arrives." : "No reminder emails until a mail transport is configured." },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Account" title="Settings" description="Sender details are used in every generated outreach message." />
      <div className="space-y-6">
        <section className="surface p-6">
          <h2 className="mb-4 text-[17px] font-medium tracking-tight">Integrations</h2>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.label} className="flex items-start gap-3 py-3 text-[13.5px]">
                {r.ok ? <CheckCircle2 className="mt-0.5 size-4 text-[#1b6a3a]" /> : <XCircle className="mt-0.5 size-4 text-muted-foreground/60" />}
                <div className="flex-1">
                  <div className="font-medium">
                    {r.label} <span className={`ml-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${r.ok ? "bg-tint-green/28 text-[#1b6a3a]" : "bg-foreground/6 text-muted-foreground"}`}>{r.ok ? "configured" : "not configured"}</span>
                  </div>
                  <div className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                    {r.note} Env: <code className="rounded-md bg-background px-1.5 font-mono text-[11.5px]">{r.env}</code>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">Keys live in <code className="rounded-md bg-background px-1.5 font-mono text-[11.5px]">.env</code> on the server only and are never sent to the browser. Restart the app and worker after changing them.</p>
        </section>
        <SettingsForm
          initial={{
            companyName: settings?.companyName ?? "",
            senderName: settings?.senderName ?? "",
            senderRole: settings?.senderRole ?? "",
            services: settings?.services ?? [],
            outreachLanguage: settings?.outreachLanguage ?? "en",
            defaultCountry: settings?.defaultCountry ?? "NL",
            signature: settings?.signature ?? "",
            aiMinOpportunity: settings?.aiMinOpportunity ?? 40,
            googleMonthlyBudget: settings?.googleMonthlyBudget ?? 900,
            googleBudgetFallback: settings?.googleBudgetFallback ?? true,
            notificationEmail: settings?.notificationEmail ?? "",
            followUpReminders: settings?.followUpReminders ?? true,
          }}
          usage={{ googlePlaces: budget.used, googleGeocoding: geocodingUsed, pagespeed: pagespeedUsed, resetsInDays: budget.resetsInDays, googleConfigured: status.googlePlaces, mailConfigured: status.mail }}
        />
      </div>
    </div>
  );
}
