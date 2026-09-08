"use client";

import { useState } from "react";
import { ImageOff, Monitor, Smartphone, ScrollText, Sparkles, CheckCircle2, AlertTriangle, Lightbulb } from "lucide-react";
import type { ProspectDTO } from "./types";
import type { IssueRecord, ScoresPayload } from "@/lib/types";
import { ScoreBar } from "@/components/score";
import { SourceTag } from "@/components/status-badge";
import { cn } from "@/lib/utils";

export function OverviewTab({ p }: { p: ProspectDTO }) {
  const a = p.analysis;
  const [shot, setShot] = useState<"desktop" | "mobile" | "full">("desktop");
  const scores = (a?.scores as ScoresPayload | null) ?? null;
  const issues = (a?.issues as IssueRecord[] | null) ?? [];
  const aiIssues = (a?.aiIssues as { title: string; detail: string; severity: string }[] | null) ?? [];
  const aiOpps = (a?.aiOpportunities as { title: string; detail: string }[] | null) ?? [];
  const aiStrengths = (a?.aiStrengths as string[] | null) ?? [];
  const available = { desktop: Boolean(a?.screenshotDesktop), mobile: Boolean(a?.screenshotMobile), full: Boolean(a?.screenshotFull) };

  if (!p.hasWebsite) {
    return (
      <div className="space-y-4">
        <div className="rounded-[1.5rem] bg-tint-orange/14 p-7">
          <p className="eyebrow mb-2">Strong signal</p>
          <h2 className="text-[20px] font-medium tracking-tight">No website found</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            This business has no website in the directory data{p.googleRating != null ? ` while it has a ${p.googleRating.toFixed(1)} rating from ${p.googleReviewCount ?? 0} Google reviews` : ""}. Businesses without a website are often the strongest prospects for a first website.
          </p>
          <div className="mt-4 text-[14px]">
            Recommended service: <span className="font-medium">{p.recommendedService ?? "New website"}</span>
          </div>
        </div>
        {scores && <ScoreBreakdownCard title="Opportunity Score" b={scores.opportunity} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {a?.fetchOutcome && a.fetchOutcome !== "ok" && (
        <div className="rounded-2xl bg-tint-yellow/20 px-5 py-3.5 text-[13.5px] leading-relaxed">
          <b>Website could not be fully loaded</b> ({a.fetchOutcome.replace("_", " ")}
          {a.fetchError ? `: ${a.fetchError}` : ""}). Scores are limited to what could be measured.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="surface overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
            <h2 className="text-[15px] font-medium">Website preview</h2>
            <div className="flex gap-1 rounded-full bg-foreground/6 p-1">
              {(["desktop", "mobile", "full"] as const).map((k) => (
                <button key={k} disabled={!available[k]} onClick={() => setShot(k)} className={cn("inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition-colors disabled:opacity-40", shot === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                  {k === "desktop" ? <Monitor className="size-3.5" /> : k === "mobile" ? <Smartphone className="size-3.5" /> : <ScrollText className="size-3.5" />}
                  {k === "desktop" ? "Desktop" : k === "mobile" ? "Mobile" : "Full page"}
                </button>
              ))}
            </div>
          </header>
          <div className={cn("flex justify-center bg-background p-4", shot === "full" && "scroll-thin max-h-[720px] overflow-y-auto")}>
            {available[shot] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/screenshots/${p.id}/${shot}`} alt={`${shot} screenshot of ${p.domain}`} className={cn("rounded-xl border border-border", shot === "mobile" ? "w-[260px]" : "w-full")} />
            ) : (
              <div className="flex h-64 w-full items-center justify-center text-[14px] text-muted-foreground">
                <ImageOff className="mr-2 size-4" /> No screenshot available
              </div>
            )}
          </div>
        </section>

        <section className="surface p-5">
          <h2 className="mb-4 text-[15px] font-medium">Scores</h2>
          <div className="space-y-3.5">
            <ScoreBar label="Overall Website Score" score={p.websiteScore} />
            <ScoreBar label="Design" score={p.designScore} hint={a?.aiDesignImpression != null ? "incl. AI" : undefined} />
            <ScoreBar label="UX" score={p.uxScore} />
            <ScoreBar label="SEO" score={p.seoScore} />
            <ScoreBar label="Performance" score={p.performanceScore} hint={a && a.psiPerformanceMobile == null ? "derived" : undefined} />
            <ScoreBar label="Conversion" score={p.conversionScore} />
            <ScoreBar label="Mobile" score={p.mobileScore} />
            <ScoreBar label="Technical" score={p.technicalScore} />
          </div>
          {scores?.website.note && <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">{scores.website.note}</p>}
        </section>
      </div>

      {/* AI analysis */}
      <section className="surface overflow-hidden">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="inline-flex items-center gap-2 text-[15px] font-medium">
            <Sparkles className="size-4" /> AI analysis <SourceTag source="ai" />
          </h2>
          {a?.aiModel && <span className="font-mono text-[11px] text-muted-foreground">{a.aiModel}</span>}
        </header>
        {a?.aiStatus === "completed" ? (
          <div className="p-5">
            {a.aiSummary && <p className="mb-5 max-w-3xl text-[15px] leading-relaxed">{a.aiSummary}</p>}
            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <h3 className="eyebrow mb-2.5 inline-flex items-center gap-1.5 text-[#1b6a3a]">
                  <CheckCircle2 className="size-3.5" /> What&apos;s working
                </h3>
                <ul className="space-y-1.5 text-[13px]">
                  {aiStrengths.map((s, i) => (
                    <li key={i} className="rounded-xl bg-tint-green/16 px-3 py-2 leading-relaxed">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="eyebrow mb-2.5 inline-flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="size-3.5" /> Critical issues
                </h3>
                <ul className="space-y-1.5 text-[13px]">
                  {aiIssues.map((s, i) => (
                    <li key={i} className="rounded-xl bg-destructive/8 px-3 py-2 leading-relaxed">
                      <div className="font-medium">
                        {s.title} <span className="ml-1 font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">{s.severity}</span>
                      </div>
                      <div className="text-muted-foreground">{s.detail}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="eyebrow mb-2.5 inline-flex items-center gap-1.5 text-[#1f4f9a]">
                  <Lightbulb className="size-3.5" /> Opportunities
                </h3>
                <ul className="space-y-1.5 text-[13px]">
                  {aiOpps.map((s, i) => (
                    <li key={i} className="rounded-xl bg-tint-blue/12 px-3 py-2 leading-relaxed">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-muted-foreground">{s.detail}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-5 text-[13px] text-muted-foreground">
              <span>
                Recommended service (AI): <b className="text-foreground">{a.aiRecommendedService}</b>
              </span>
              <span>
                Design impression (AI observation): <b className="text-foreground">{a.aiDesignImpression}/100</b>
              </span>
            </div>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-[14px] leading-relaxed text-muted-foreground">
            {a?.aiStatus === "not_configured" || !a ? "AI analysis is not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env to enable it." : a.aiStatus === "skipped" ? "AI analysis skipped for this prospect (opportunity score below your AI threshold). Use “Run AI analysis” to run it anyway." : `AI analysis failed: ${a.aiError ?? "unknown error"}`}
          </p>
        )}
      </section>

      {/* Measured issues */}
      <section className="surface overflow-hidden">
        <header className="flex items-baseline gap-2 border-b border-border px-5 py-3">
          <h2 className="text-[15px] font-medium">Detected problems</h2>
          <span className="font-mono text-[12px] text-muted-foreground">{issues.length}</span>
        </header>
        {issues.length === 0 ? (
          <p className="px-5 py-8 text-center text-[14px] text-muted-foreground">No problems detected.</p>
        ) : (
          <ul className="divide-y divide-border">
            {issues.map((i) => (
              <li key={i.key} className="flex items-start gap-3 px-5 py-2.5 text-[13.5px]">
                <span className={cn("mt-0.5 inline-flex h-5 w-[68px] shrink-0 items-center justify-center rounded-full font-mono text-[9.5px] font-medium uppercase tracking-wider", i.severity === "critical" ? "bg-destructive/12 text-destructive" : i.severity === "high" ? "bg-tint-orange/22 text-[#8a3d12]" : i.severity === "medium" ? "bg-tint-yellow/30 text-[#6d5100]" : "bg-foreground/6 text-muted-foreground")}>{i.severity}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{i.label}</div>
                  {i.detail && <div className="truncate text-[12.5px] text-muted-foreground">{i.detail}</div>}
                </div>
                <span className="eyebrow">{i.category}</span>
                <SourceTag source={i.source} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {scores && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ScoreBreakdownCard title="Website Score breakdown" b={scores.website} />
          <ScoreBreakdownCard title="Opportunity Score breakdown" b={scores.opportunity} />
        </div>
      )}
    </div>
  );
}

export function ScoreBreakdownCard({ title, b }: { title: string; b: ScoresPayload["website"] }) {
  const totalW = b.components.reduce((s, c) => s + c.weight, 0) || 1;
  return (
    <section className="surface p-5">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-medium">{title}</h2>
        <span className="font-mono text-[20px] font-medium tabular-nums">{b.score}</span>
      </header>
      <ul className="space-y-2">
        {b.components.map((c) => (
          <li key={c.key} className="grid grid-cols-[1fr_44px_48px] items-center gap-3 text-[12.5px]">
            <div className="min-w-0">
              <div className="truncate">{c.label}</div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-foreground/8">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${c.score ?? 0}%` }} />
              </div>
            </div>
            <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{Math.round((c.weight / totalW) * 100)}%</span>
            <span className="text-right font-mono tabular-nums">{c.score == null ? "n/a" : c.score}</span>
          </li>
        ))}
      </ul>
      {b.note && <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">{b.note}</p>}
    </section>
  );
}
