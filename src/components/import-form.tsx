"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { COUNTRIES } from "@/lib/industries";
import { parseImportLines } from "@/lib/import-parse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IndustryPicker } from "@/components/industry-picker";

const EXAMPLE = `Bakkerij De Korenaar, Haarlem
Schildersbedrijf Vermeulen, Heemstede
https://www.facebook.com/kapsalonlindaZandvoort
Fysio Praktijk Bos`;

export function ImportForm({ defaultCountry, googleConfigured }: { defaultCountry: string; googleConfigured: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [countryCode, setCountryCode] = useState(defaultCountry);
  const [defaultCity, setDefaultCity] = useState("");
  const [industryKey, setIndustryKey] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const lang: "nl" | "en" = COUNTRIES.find((c) => c.code === countryCode)?.lang === "nl" ? "nl" : "en";

  const items = useMemo(() => parseImportLines(text, defaultCity || null), [text, defaultCity]);
  const withoutCity = items.filter((i) => !i.city).length;

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/scans/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, countryCode, defaultCity: defaultCity || undefined, industryKey, sourceLabel: sourceLabel || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "Import failed");
      toast.success(`Importing ${d.count} businesses`);
      router.push(`/scans/${d.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="surface p-6">
        <h2 className="mb-1 text-[17px] font-medium tracking-tight">1. Paste the businesses</h2>
        <p className="mb-4 text-[13.5px] text-muted-foreground">
          One per line. Write <span className="font-medium text-foreground">Name, City</span> or paste a Facebook page link. Joyscrape looks every line up{googleConfigured ? " in Google Places" : " in OpenStreetMap"}, finds the website and contact details, and runs the full analysis.
        </p>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} className="min-h-[220px] font-mono text-[13px] leading-relaxed" spellCheck={false} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-muted-foreground">
          <span>
            {items.length === 0 ? "Nothing recognised yet." : `${items.length} ${items.length === 1 ? "business" : "businesses"} recognised`}
            {items.length > 0 && withoutCity > 0 && !defaultCity ? ` · ${withoutCity} without a city (add a default city below)` : ""}
            {items.length > 0 ? ` · ${items.filter((i) => i.facebook).length} with a Facebook page` : ""}
          </span>
          <button type="button" className="font-medium text-brand-ink hover:underline" onClick={() => setText(EXAMPLE)}>
            Use the example
          </button>
        </div>
      </section>

      <section className="surface p-6">
        <h2 className="mb-4 text-[17px] font-medium tracking-tight">2. Defaults</h2>
        <div className="grid gap-4 sm:grid-cols-2 [&_label]:eyebrow">
          <div className="space-y-1.5">
            <Label>Default city (for lines without one)</Label>
            <Input value={defaultCity} onChange={(e) => setDefaultCity(e.target.value)} placeholder="Haarlem" />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Select value={countryCode} onValueChange={setCountryCode}>
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
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Industry (optional, improves scoring)</Label>
            <IndustryPicker
              lang={lang}
              industryKey={industryKey}
              customQuery={customQuery}
              onChange={(n) => {
                setIndustryKey(n.industryKey);
                setCustomQuery(n.customQuery);
              }}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Source (shown as the scan name)</Label>
            <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="Facebook group “Ondernemers Haarlem”" maxLength={120} />
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-full border border-border bg-primary px-5 py-3 text-primary-foreground shadow-flyout">
        <span className="text-[13.5px] text-primary-foreground/80">{items.length > 0 ? `${items.length} businesses will be looked up and analysed.` : "Paste a list to begin."}</span>
        <Button onClick={submit} disabled={busy || items.length === 0} className="rounded-full bg-background text-foreground hover:bg-background/90">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPaste className="size-4" />} Import {items.length > 0 ? items.length : ""} {items.length === 1 ? "business" : "businesses"}
        </Button>
      </div>
    </div>
  );
}
