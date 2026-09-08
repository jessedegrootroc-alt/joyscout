"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Info, Sparkles } from "lucide-react";
import { INDUSTRIES, COUNTRIES } from "@/lib/industries";
import type { ScanFilters } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type Preset = {
  query?: string;
  industryKey?: string | null;
  location?: string;
  countryCode?: string;
  radiusKm?: number;
  maxResults?: number;
  filters?: Partial<ScanFilters>;
  savedSearchId?: string;
  name?: string;
};

export function FindProspectsForm({
  defaultCountry,
  providers,
  preset,
}: {
  defaultCountry: string;
  providers: { googlePlaces: boolean; pagespeed: boolean; ai: boolean };
  preset?: Preset;
}) {
  const router = useRouter();
  const [industryKey, setIndustryKey] = useState<string | null>(preset?.industryKey ?? null);
  const [customQuery, setCustomQuery] = useState(preset?.industryKey ? "" : preset?.query ?? "");
  const [location, setLocation] = useState(preset?.location ?? "");
  const [countryCode, setCountryCode] = useState(preset?.countryCode ?? defaultCountry);
  const [radiusKm, setRadiusKm] = useState(preset?.radiusKm ?? 25);
  const [maxResults, setMaxResults] = useState(preset?.maxResults ?? 60);
  const [minReviews, setMinReviews] = useState<number | "">(preset?.filters?.minReviews ?? "");
  const [websiteRequired, setWebsiteRequired] = useState<"any" | "yes" | "no">(preset?.filters?.websiteRequired ?? "any");
  const [maxWebsiteScore, setMaxWebsiteScore] = useState<number | "">(preset?.filters?.maxWebsiteScore ?? "");
  const [minOpportunity, setMinOpportunity] = useState<number | "">(preset?.filters?.minOpportunityScore ?? "");
  const [saveSearch, setSaveSearch] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const lang = useMemo(() => (COUNTRIES.find((c) => c.code === countryCode)?.lang === "nl" ? "nl" : "en"), [countryCode]);
  const selectedIndustry = industryKey ? INDUSTRIES.find((i) => i.key === industryKey) : null;
  const query = selectedIndustry ? selectedIndustry.terms[lang][0] : customQuery.trim();
  const canSubmit = query.length >= 2 && location.trim().length >= 2 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    const filters: ScanFilters = {
      websiteRequired,
      minReviews: minReviews === "" ? undefined : Number(minReviews),
      maxWebsiteScore: maxWebsiteScore === "" ? undefined : Number(maxWebsiteScore),
      minOpportunityScore: minOpportunity === "" ? undefined : Number(minOpportunity),
    };
    const res = await fetch("/api/scans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query, industryKey, location: location.trim(), countryCode, radiusKm, maxResults, filters, saveSearch }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not start scan");
      return;
    }
    const { id } = await res.json();
    router.push(`/scans/${id}`);
  }

  return (
    <div className="space-y-5">
      {!providers.googlePlaces && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-tint-yellow/60 bg-tint-yellow/18 px-4 py-3 text-[13.5px] leading-relaxed text-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>Google Places is not configured.</strong> Businesses are discovered via OpenStreetMap instead: fewer results and no Google
            ratings or review counts. Add <code className="rounded-md bg-card px-1.5 font-mono text-[12px]">GOOGLE_PLACES_API_KEY</code> in{" "}
            <code className="rounded-md bg-card px-1.5 font-mono text-[12px]">.env</code> for full data.
          </div>
        </div>
      )}

      <Step n={1} title="What type of businesses are you looking for?">
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((ind) => (
            <button
              key={ind.key}
              type="button"
              onClick={() => {
                setIndustryKey(ind.key === industryKey ? null : ind.key);
                setCustomQuery("");
              }}
              aria-pressed={industryKey === ind.key}
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full border border-input bg-card px-4 text-[14px] font-medium transition-[background-color,border-color,color,transform] duration-200 hover:bg-surface-hover active:scale-[0.98]",
                industryKey === ind.key && "border-primary bg-primary text-primary-foreground hover:bg-black",
              )}
            >
              {ind.label[lang]}
              {lang !== "en" && <span className={cn("hidden text-[12px] font-normal text-muted-foreground sm:inline", industryKey === ind.key && "text-primary-foreground/60")}>{ind.label.en}</span>}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="font-hand text-[20px] text-muted-foreground">or</span>
          <Input
            value={customQuery}
            onChange={(e) => {
              setCustomQuery(e.target.value);
              if (e.target.value) setIndustryKey(null);
            }}
            placeholder={lang === "nl" ? "Eigen zoekterm, bv. “tegelzetter”" : "Custom search term, e.g. “tiling contractor”"}
            className="h-10 max-w-sm"
          />
        </div>
      </Step>

      <Step n={2} title="Where?">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="space-y-1.5">
            <Label htmlFor="location">City, region or postal code</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Amsterdam" />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger>
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
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Radius</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{radiusKm} km</span>
            </div>
            <Slider value={[radiusKm]} min={2} max={50} step={1} onValueChange={(v) => setRadiusKm(v[0])} />
          </div>
          <div className="space-y-1.5">
            <Label>Max. businesses</Label>
            <Select value={String(maxResults)} onValueChange={(v) => setMaxResults(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[20, 40, 60, 100, 150, 200].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} businesses
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Step>

      <Step n={3} title="Filters" optional>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Minimum Google reviews</Label>
            <Input type="number" min={0} value={minReviews} onChange={(e) => setMinReviews(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 10" />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Select value={websiteRequired} onValueChange={(v) => setWebsiteRequired(v as "any" | "yes" | "no")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any (include businesses without a website)</SelectItem>
                <SelectItem value="yes">Website required</SelectItem>
                <SelectItem value="no">Only businesses without a website</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Website Score below</Label>
            <Input type="number" min={0} max={100} value={maxWebsiteScore} onChange={(e) => setMaxWebsiteScore(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 60" />
            <p className="text-[12px] text-muted-foreground">Applied to the result view after analysis.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Opportunity Score above</Label>
            <Input type="number" min={0} max={100} value={minOpportunity} onChange={(e) => setMinOpportunity(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 60" />
          </div>
        </div>
        <label className="mt-5 flex items-center gap-2.5 text-[14px]">
          <Checkbox checked={saveSearch} onCheckedChange={(v) => setSaveSearch(Boolean(v))} />
          Save this search so I can run it again later
        </label>
      </Step>

      <div className="flex flex-col gap-4 rounded-[1.5rem] bg-primary p-5 text-primary-foreground sm:flex-row sm:items-center sm:justify-between md:p-6">
        <div className="text-[14px] leading-relaxed text-primary-foreground/70">
          {query && location ? (
            <>
              Searching <span className="font-medium text-primary-foreground">{selectedIndustry ? selectedIndustry.label[lang] : query}</span> within{" "}
              <span className="font-medium text-primary-foreground">{radiusKm} km</span> of <span className="font-medium text-primary-foreground">{location}</span>.
              <span className="ml-1 inline-flex items-center gap-1">
                {providers.pagespeed ? null : <span title="No PageSpeed key: performance derived from own timings">· PageSpeed limited</span>}
                {providers.ai ? <Sparkles className="size-3" /> : <span>· AI analysis off</span>}
              </span>
            </>
          ) : (
            "Pick an industry and a location to begin."
          )}
        </div>
        <Button size="lg" onClick={submit} disabled={!canSubmit} className="h-12 shrink-0 bg-card px-7 text-[15px] text-foreground hover:bg-white disabled:bg-card/60">
          <Search className="size-4" />
          {submitting ? "Starting…" : "Find prospects"}
        </Button>
      </div>
    </div>
  );
}

function Step({ n, title, optional, children }: { n: number; title: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-card p-6 md:p-7">
      <header className="mb-5 flex items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary font-mono text-[12px] font-medium text-primary-foreground">{n}</span>
        <h2 className="text-[17px] font-medium tracking-tight">{title}</h2>
        {optional && <span className="eyebrow">optional</span>}
      </header>
      {children}
    </section>
  );
}
