"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Radar } from "lucide-react";
import { INDUSTRIES, COUNTRIES } from "@/lib/industries";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const NONE = "__none";

export function RadarForm({ lists, defaultCountry }: { lists: { id: string; name: string }[]; defaultCountry: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [industryKey, setIndustryKey] = useState<string>(NONE);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [countryCode, setCountryCode] = useState(defaultCountry);
  const [radiusKm, setRadiusKm] = useState(25);
  const [maxResults, setMaxResults] = useState(40);
  const [frequency, setFrequency] = useState("WEEKLY");
  const [minOpportunity, setMinOpportunity] = useState<number | "">(70);
  const [maxWebsiteScore, setMaxWebsiteScore] = useState<number | "">("");
  const [minReviews, setMinReviews] = useState<number | "">("");
  const [listId, setListId] = useState<string>(NONE);
  const [runNow, setRunNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const lang = COUNTRIES.find((c) => c.code === countryCode)?.lang === "nl" ? "nl" : "en";
  const ind = industryKey !== NONE ? INDUSTRIES.find((i) => i.key === industryKey) : undefined;
  const finalQuery = ind ? ind.terms[lang][0] : query.trim();

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/radars", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: finalQuery, industryKey: ind?.key ?? null, location: location.trim(), countryCode, radiusKm, maxResults, frequency, listId: listId === NONE ? undefined : listId, runNow, filters: { websiteRequired: "any", minOpportunityScore: minOpportunity === "" ? undefined : minOpportunity, maxWebsiteScore: maxWebsiteScore === "" ? undefined : maxWebsiteScore, minReviews: minReviews === "" ? undefined : minReviews } }),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(d.error ?? "Could not create radar");
    toast.success(runNow ? "Radar created — first scan queued" : "Radar created");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> Add radar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <Radar className="size-4" /> Add a radar
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 text-[13.5px] sm:grid-cols-2 [&_label]:eyebrow">
            <div className="space-y-1 sm:col-span-2">
              <Label>Industry</Label>
              <Select value={industryKey} onValueChange={setIndustryKey}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Custom search term…</SelectItem>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i.key} value={i.key}>
                      {i.label[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {industryKey === NONE && <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. tegelzetter" className="mt-1" />}
            </div>
            <div className="space-y-1">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Amsterdam" />
            </div>
            <div className="space-y-1">
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
            <div className="space-y-1">
              <Label>Radius (km)</Label>
              <Input type="number" min={1} max={50} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value) || 25)} />
            </div>
            <div className="space-y-1">
              <Label>Max. businesses per scan</Label>
              <Select value={String(maxResults)} onValueChange={(v) => setMaxResults(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[20, 40, 60, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cadence</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="BIWEEKLY">Every two weeks</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Target list</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Create a new list for this radar</SelectItem>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Opportunity Score ≥</Label>
              <Input type="number" min={0} max={100} value={minOpportunity} onChange={(e) => setMinOpportunity(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Website Score ≤ (optional)</Label>
              <Input type="number" min={0} max={100} value={maxWebsiteScore} onChange={(e) => setMaxWebsiteScore(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Min. Google reviews (optional)</Label>
              <Input type="number" min={0} value={minReviews} onChange={(e) => setMinReviews(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <label className="flex items-center gap-2.5 sm:col-span-2 !font-sans !text-[14px] !normal-case !tracking-normal !text-foreground">
              <Checkbox checked={runNow} onCheckedChange={(v) => setRunNow(Boolean(v))} /> Run the first scan now
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy || finalQuery.length < 2 || location.trim().length < 2}>
              {busy ? "Saving…" : "Create radar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
