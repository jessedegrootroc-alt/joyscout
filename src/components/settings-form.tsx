"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { COUNTRIES } from "@/lib/industries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Values = { companyName: string; senderName: string; senderRole: string; services: string[]; outreachLanguage: string; defaultCountry: string; signature: string; aiMinOpportunity: number; googleMonthlyBudget: number; googleBudgetFallback: boolean; notificationEmail: string; followUpReminders: boolean };
type Usage = { googlePlaces: number; googleGeocoding: number; pagespeed: number; resetsInDays: number; googleConfigured: boolean; mailConfigured: boolean };

export function SettingsForm({ initial, usage }: { initial: Values; usage: Usage }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [servicesText, setServicesText] = useState(initial.services.join(", "));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...v, companyName: v.companyName || null, senderName: v.senderName || null, senderRole: v.senderRole || null, signature: v.signature || null, notificationEmail: v.notificationEmail.trim() || null, services: servicesText.split(",").map((s) => s.trim()).filter(Boolean) }),
    });
    setBusy(false);
    if (!res.ok) return toast.error("Could not save settings");
    toast.success("Settings saved");
    router.refresh();
  }
  const pct = initial.googleMonthlyBudget > 0 ? Math.min(100, Math.round((usage.googlePlaces / initial.googleMonthlyBudget) * 100)) : 100;
  const [testing, setTesting] = useState(false);
  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/settings/test-mail", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: v.notificationEmail }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(d.error ?? "Test email failed");
      else toast.success(`Test reminder sent to ${v.notificationEmail} (${d.transport})`);
    } finally {
      setTesting(false);
    }
  }
  return (
    <>
    <section className="surface p-6">
      <h2 className="mb-1 text-[17px] font-medium tracking-tight">Follow-up reminders</h2>
      <p className="mb-5 text-[13.5px] text-muted-foreground">When a prospect&apos;s follow-up date arrives you get one email per prospect, with a link to the follow-up message written out and ready to copy.</p>
      <div className="grid gap-5 sm:grid-cols-2 [&_label]:eyebrow">
        <div className="space-y-1">
          <Label>Send reminders to</Label>
          <Input type="email" value={v.notificationEmail} onChange={(e) => setV({ ...v, notificationEmail: e.target.value })} placeholder="you@yourstudio.nl" autoComplete="email" />
          {!usage.mailConfigured && <p className="text-[12.5px] text-muted-foreground">The server has no mail transport yet: add <code className="font-mono text-[11.5px]">RESEND_API_KEY</code> (or <code className="font-mono text-[11.5px]">SMTP_HOST</code>) and <code className="font-mono text-[11.5px]">MAIL_FROM</code> to the environment.</p>}
        </div>
        <div className="space-y-1">
          <Label>Reminders</Label>
          <Select value={v.followUpReminders ? "on" : "off"} onValueChange={(x) => setV({ ...v, followUpReminders: x === "on" })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="on">On: email me when a follow-up is due</SelectItem>
              <SelectItem value="off">Off</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[12.5px] text-muted-foreground">Checked every 15 minutes by the worker. One email per prospect per follow-up date.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={sendTest} disabled={testing || !usage.mailConfigured || !v.notificationEmail.includes("@")} title={usage.mailConfigured ? "Send a sample reminder to this address" : "Configure a mail transport first"}>
          {testing ? "Sending…" : "Send test email"}
        </Button>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save reminders"}
        </Button>
      </div>
    </section>
    <section className="surface p-6">
      <h2 className="mb-1 text-[17px] font-medium tracking-tight">API budget</h2>
      <p className="mb-5 text-[13.5px] text-muted-foreground">Google gives every paid tier a free monthly allowance. Keep the budget under that allowance and Joyscrape never spends money: when it is reached, scans switch to OpenStreetMap.</p>
      <div className="grid gap-5 sm:grid-cols-2 [&_label]:eyebrow">
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Google Places requests this month</span>
            <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
              {usage.googlePlaces} / {v.googleMonthlyBudget} · resets in {usage.resetsInDays} day{usage.resetsInDays === 1 ? "" : "s"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-foreground/8">
            <div className={`h-full rounded-full transition-[width] duration-700 ${pct >= 100 ? "bg-destructive" : pct >= 80 ? "bg-tint-orange" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
          {!usage.googleConfigured && <p className="text-[12.5px] text-muted-foreground">Google Places is not configured, so no requests are being made yet.</p>}
        </div>
        <div className="space-y-1">
          <Label>Monthly budget (Text Search requests)</Label>
          <Input type="number" min={0} value={v.googleMonthlyBudget} onChange={(e) => setV({ ...v, googleMonthlyBudget: Math.max(0, Number(e.target.value) || 0) })} />
          <p className="text-[12.5px] text-muted-foreground">Each request returns up to 20 businesses. Google&apos;s free allowance for this tier is about 1,000 per month; 900 keeps a margin.</p>
        </div>
        <div className="space-y-1">
          <Label>When the budget is reached</Label>
          <Select value={v.googleBudgetFallback ? "fallback" : "stop"} onValueChange={(x) => setV({ ...v, googleBudgetFallback: x === "fallback" })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fallback">Switch to OpenStreetMap (free, no ratings)</SelectItem>
              <SelectItem value="stop">Stop scans until the budget resets</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 text-[12.5px] text-muted-foreground sm:col-span-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-border px-4 py-3">
            <div className="eyebrow">Geocoding requests</div>
            <div className="mt-1 font-mono text-[15px] font-medium text-foreground">{usage.googleGeocoding}</div>
            <div>Free allowance is far higher; not budgeted.</div>
          </div>
          <div className="rounded-2xl border border-border px-4 py-3">
            <div className="eyebrow">PageSpeed requests</div>
            <div className="mt-1 font-mono text-[15px] font-medium text-foreground">{usage.pagespeed}</div>
            <div>Free API; tracked for insight only.</div>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save budget"}
        </Button>
      </div>
    </section>
    <section className="surface p-6">
      <h2 className="mb-1 text-[17px] font-medium tracking-tight">Outreach sender</h2>
      <p className="mb-5 text-[13.5px] text-muted-foreground">Used to sign every generated message.</p>
      <div className="grid gap-5 sm:grid-cols-2 [&_label]:eyebrow">
        <div className="space-y-1">
          <Label>Your name</Label>
          <Input value={v.senderName} onChange={(e) => setV({ ...v, senderName: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Agency / company</Label>
          <Input value={v.companyName} onChange={(e) => setV({ ...v, companyName: e.target.value })} placeholder="Studio Example" />
        </div>
        <div className="space-y-1">
          <Label>Role</Label>
          <Input value={v.senderRole} onChange={(e) => setV({ ...v, senderRole: e.target.value })} placeholder="Web designer" />
        </div>
        <div className="space-y-1">
          <Label>Services you offer (comma separated)</Label>
          <Input value={servicesText} onChange={(e) => setServicesText(e.target.value)} placeholder="web design, SEO, conversion optimization" />
        </div>
        <div className="space-y-1">
          <Label>Outreach language</Label>
          <Select value={v.outreachLanguage} onValueChange={(x) => setV({ ...v, outreachLanguage: x })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="nl">Dutch</SelectItem>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="fr">French</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Default country for searches</Label>
          <Select value={v.defaultCountry} onValueChange={(x) => setV({ ...v, defaultCountry: x })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Signature (optional)</Label>
          <Textarea value={v.signature} onChange={(e) => setV({ ...v, signature: e.target.value })} placeholder={"Jane Doe\nStudio Example · +31 6 1234 5678"} className="min-h-[70px]" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>AI cost gate: run AI analysis only when Opportunity Score ≥ {v.aiMinOpportunity}</Label>
          <input type="range" min={0} max={100} value={v.aiMinOpportunity} onChange={(e) => setV({ ...v, aiMinOpportunity: Number(e.target.value) })} className="w-full accent-[#1a1a1a]" />
          <p className="text-[12.5px] text-muted-foreground">Lower = more prospects get the (paid) AI analysis automatically. You can always run it manually on a prospect.</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </section>
    </>
  );
}
