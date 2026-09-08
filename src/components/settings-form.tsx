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

type Values = { companyName: string; senderName: string; senderRole: string; services: string[]; outreachLanguage: string; defaultCountry: string; signature: string; aiMinOpportunity: number };

export function SettingsForm({ initial }: { initial: Values }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [servicesText, setServicesText] = useState(initial.services.join(", "));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...v, companyName: v.companyName || null, senderName: v.senderName || null, senderRole: v.senderRole || null, signature: v.signature || null, services: servicesText.split(",").map((s) => s.trim()).filter(Boolean) }),
    });
    setBusy(false);
    if (!res.ok) return toast.error("Could not save settings");
    toast.success("Settings saved");
    router.refresh();
  }
  return (
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
  );
}
