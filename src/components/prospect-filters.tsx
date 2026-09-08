"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ISSUE_FILTERS, LEAD_STATUSES, LEAD_STATUS_LABEL, PLATFORMS, SORT_OPTIONS } from "@/lib/types";

const ANY = "__any";

export function ProspectFilters({ cities, industries }: { cities: string[]; industries: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  const set = useCallback(
    (patch: Record<string, string | string[] | null>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === "" || v === ANY || (Array.isArray(v) && v.length === 0)) next.delete(k);
        else next.set(k, Array.isArray(v) ? v.join(",") : v);
      }
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [router, pathname, sp],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== q) set({ q });
    }, 300);
    return () => clearTimeout(t);
  }, [q, set, sp]);

  const get = (k: string) => sp.get(k) ?? ANY;
  const getArr = (k: string) => (sp.get(k) ? sp.get(k)!.split(",") : []);
  const activeCount = ["websiteScore", "opportunityScore", "seoScore", "minRating", "minReviews", "hasWebsite", "hasEmail", "hasPhone", "platform", "issues", "status", "labels", "city", "industry"].filter((k) => sp.get(k)).length;
  const keep = ["scanId", "listId"];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, website, email, city…" className="h-9 w-[240px] rounded-full pl-4" />

      <Select value={get("opportunityScore")} onValueChange={(v) => set({ opportunityScore: v })}>
        <SelectTrigger className="h-9 w-[165px] rounded-full" size="sm">
          <SelectValue placeholder="Opportunity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Opportunity: any</SelectItem>
          <SelectItem value="80-100">🔥 80+ (hot)</SelectItem>
          <SelectItem value="65-100">65+ (high)</SelectItem>
          <SelectItem value="40-65">40–65</SelectItem>
          <SelectItem value="0-40">Below 40</SelectItem>
        </SelectContent>
      </Select>

      <Select value={get("websiteScore")} onValueChange={(v) => set({ websiteScore: v })}>
        <SelectTrigger className="h-9 w-[170px] rounded-full" size="sm">
          <SelectValue placeholder="Website Score" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Website Score: any</SelectItem>
          <SelectItem value="0-30">0–30 (bad)</SelectItem>
          <SelectItem value="30-50">30–50</SelectItem>
          <SelectItem value="50-70">50–70</SelectItem>
          <SelectItem value="70-100">70+</SelectItem>
        </SelectContent>
      </Select>

      <Select value={get("seoScore")} onValueChange={(v) => set({ seoScore: v })}>
        <SelectTrigger className="h-9 w-[130px] rounded-full" size="sm">
          <SelectValue placeholder="SEO" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>SEO: any</SelectItem>
          <SelectItem value="0-30">0–30</SelectItem>
          <SelectItem value="30-50">30–50</SelectItem>
          <SelectItem value="50-70">50–70</SelectItem>
          <SelectItem value="70-100">70+</SelectItem>
        </SelectContent>
      </Select>

      <Select value={get("hasWebsite")} onValueChange={(v) => set({ hasWebsite: v })}>
        <SelectTrigger className="h-9 w-[140px] rounded-full" size="sm">
          <SelectValue placeholder="Website" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Website: any</SelectItem>
          <SelectItem value="yes">Has website</SelectItem>
          <SelectItem value="no">No website</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <SlidersHorizontal className="size-3.5" /> More filters
            {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">{activeCount}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(560px,calc(100vw-2rem))] p-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Google rating ≥">
              <Select value={get("minRating")} onValueChange={(v) => set({ minRating: v })}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {["3", "3.5", "4", "4.3", "4.5", "4.8"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v} ★
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reviews ≥">
              <Select value={get("minReviews")} onValueChange={(v) => set({ minReviews: v })}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {["5", "10", "25", "50", "100", "250"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}+
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Email available">
              <Select value={get("hasEmail")} onValueChange={(v) => set({ hasEmail: v })}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Phone available">
              <Select value={get("hasPhone")} onValueChange={(v) => set({ hasPhone: v })}>
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="City">
              <Select value={get("city")} onValueChange={(v) => set({ city: v })}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Industry">
              <Select value={get("industry")} onValueChange={(v) => set({ industry: v })}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any</SelectItem>
                  {industries.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <CheckGroup label="Platform" options={PLATFORMS.map((p) => ({ value: p, label: p }))} values={getArr("platform")} onChange={(v) => set({ platform: v })} />
            <CheckGroup label="Problems" options={ISSUE_FILTERS.map((i) => ({ value: i.key, label: i.label }))} values={getArr("issues")} onChange={(v) => set({ issues: v })} />
            <CheckGroup label="Lead status" options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))} values={getArr("status")} onChange={(v) => set({ status: v })} />
          </div>
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-2">
        {(activeCount > 0 || sp.get("q")) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={() => {
              const next = new URLSearchParams();
              keep.forEach((k) => sp.get(k) && next.set(k, sp.get(k)!));
              if (sp.get("sort")) next.set("sort", sp.get("sort")!);
              setQ("");
              router.push(`${pathname}?${next.toString()}`);
            }}
          >
            <X className="size-3.5" /> Clear
          </Button>
        )}
        <Select value={sp.get("sort") ?? "opportunity_desc"} onValueChange={(v) => set({ sort: v })}>
          <SelectTrigger className="h-9 w-[200px] rounded-full" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key}>
                Sort: {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}

function CheckGroup({ label, options, values, onChange }: { label: string; options: { value: string; label: string }[]; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2 text-[13px]">
      <div className="eyebrow">{label}</div>
      <div className="scroll-thin max-h-44 space-y-1.5 overflow-y-auto pr-1">
        {options.map((o) => {
          const checked = values.includes(o.value);
          return (
            <label key={o.value} className="flex items-center gap-2">
              <Checkbox checked={checked} onCheckedChange={(v) => onChange(v ? [...values, o.value] : values.filter((x) => x !== o.value))} />
              {o.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
