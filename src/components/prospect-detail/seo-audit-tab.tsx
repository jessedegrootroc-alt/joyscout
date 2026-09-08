"use client";

import { Check, X, Minus } from "lucide-react";
import type { ProspectDTO } from "./types";
import type { CheckRecord } from "@/lib/types";
import { SourceTag } from "@/components/status-badge";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = { seo: "SEO", technical: "Technical", ux: "UX", conversion: "Conversion", performance: "Performance", mobile: "Mobile", design: "Design" };
const ORDER = ["seo", "technical", "mobile", "ux", "conversion", "performance", "design"];

export function SeoAuditTab({ p }: { p: ProspectDTO }) {
  const a = p.analysis;
  const checks = (a?.checks as CheckRecord[] | null) ?? [];
  if (!p.hasWebsite || checks.length === 0) return <p className="surface px-5 py-12 text-center text-[14px] text-muted-foreground">{p.hasWebsite ? "No audit data yet." : "No website to audit."}</p>;
  const groups = ORDER.map((cat) => ({ cat, items: checks.filter((c) => c.category === cat) })).filter((g) => g.items.length);
  return (
    <div className="space-y-5">
      {a && (
        <section className="surface p-5 text-[13.5px]">
          <h2 className="mb-3 text-[15px] font-medium">On-page snapshot</h2>
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[150px_1fr] [&_dt]:eyebrow [&_dt]:pt-0.5">
            <dt className="text-muted-foreground">Title</dt>
            <dd>
              {a.title ?? <em className="text-muted-foreground">missing</em>} {a.title && <span className="text-xs text-muted-foreground">({a.title.length} chars)</span>}
            </dd>
            <dt className="text-muted-foreground">Meta description</dt>
            <dd>
              {a.metaDescription ?? <em className="text-muted-foreground">missing</em>} {a.metaDescription && <span className="text-xs text-muted-foreground">({a.metaDescription.length} chars)</span>}
            </dd>
            <dt className="text-muted-foreground">H1</dt>
            <dd>{a.h1.length ? a.h1.join(" · ") : <em className="text-muted-foreground">missing</em>}</dd>
            <dt className="text-muted-foreground">Canonical</dt>
            <dd className="truncate">{a.canonical ?? <em className="text-muted-foreground">missing</em>}</dd>
            <dt className="text-muted-foreground">Schema types</dt>
            <dd>{a.schemaTypes.length ? a.schemaTypes.join(", ") : <em className="text-muted-foreground">none</em>}</dd>
            <dt className="text-muted-foreground">Images</dt>
            <dd>
              {a.imagesTotal} total, {a.imagesMissingAlt} without alt text
            </dd>
            <dt className="text-muted-foreground">Words on homepage</dt>
            <dd>{a.wordCount}</dd>
            <dt className="text-muted-foreground">Language</dt>
            <dd>{a.lang ?? <em className="text-muted-foreground">not set</em>}</dd>
          </dl>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.cat} className="surface overflow-hidden">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-[15px] font-medium">{CATEGORY_LABEL[g.cat]} checks</h2>
            <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
              {g.items.filter((c) => c.passed === true).length}/{g.items.filter((c) => c.passed !== null).length} passed
            </span>
          </header>
          <ul className="divide-y divide-border">
            {g.items.map((c) => (
              <li key={c.key} className="flex items-center gap-3 px-5 py-2 text-[13.5px]">
                <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full", c.passed === true ? "bg-tint-green/30 text-[#1b6a3a]" : c.passed === false ? "bg-destructive/12 text-destructive" : "bg-foreground/6 text-muted-foreground")}>
                  {c.passed === true ? <Check className="size-3" /> : c.passed === false ? <X className="size-3" /> : <Minus className="size-3" />}
                </span>
                <span className="flex-1">{c.label}</span>
                {c.value != null && c.value !== "" && <span className="max-w-[320px] truncate font-mono text-[11.5px] text-muted-foreground">{String(c.value)}</span>}
                {c.passed === null && <span className="eyebrow">not measured</span>}
                <SourceTag source={c.source} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
