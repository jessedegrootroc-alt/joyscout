"use client";

import type { ProspectDTO } from "./types";
import { ScoreRing } from "@/components/score";
import { SourceTag } from "@/components/status-badge";

export function PerformanceTab({ p }: { p: ProspectDTO }) {
  const a = p.analysis;
  if (!p.hasWebsite || !a) return <p className="surface px-5 py-12 text-center text-[14px] text-muted-foreground">No performance data.</p>;
  const psi = a.psiMobile as { audits?: Record<string, { score: number | null; displayValue?: string; title: string }>; error?: string } | null;
  const hasPsi = a.psiPerformanceMobile != null;
  const metrics = [
    { label: "Largest Contentful Paint", value: a.lcpMs != null ? `${(a.lcpMs / 1000).toFixed(1)} s` : null, good: a.lcpMs != null && a.lcpMs <= 2500 },
    { label: "Cumulative Layout Shift", value: a.cls != null ? a.cls.toFixed(3) : null, good: a.cls != null && a.cls <= 0.1 },
    { label: "Total Blocking Time", value: a.tbtMs != null ? `${Math.round(a.tbtMs)} ms` : null, good: a.tbtMs != null && a.tbtMs <= 200 },
    { label: "First Contentful Paint", value: a.fcpMs != null ? `${(a.fcpMs / 1000).toFixed(1)} s` : null, good: a.fcpMs != null && a.fcpMs <= 1800 },
    { label: "Speed Index", value: a.speedIndexMs != null ? `${(a.speedIndexMs / 1000).toFixed(1)} s` : null, good: a.speedIndexMs != null && a.speedIndexMs <= 3400 },
  ].filter((m) => m.value != null);
  const own = [
    { label: "Server response (TTFB)", value: a.ttfbMs != null ? `${a.ttfbMs} ms` : null },
    { label: "DOM content loaded", value: a.domContentLoadedMs != null ? `${(a.domContentLoadedMs / 1000).toFixed(1)} s` : null },
    { label: "Page load", value: a.loadMs != null ? `${(a.loadMs / 1000).toFixed(1)} s` : null },
    { label: "Transferred", value: a.totalTransferBytes != null ? `${(a.totalTransferBytes / 1e6).toFixed(1)} MB` : null },
    { label: "Requests", value: a.requestsCount ? String(a.requestsCount) : null },
    { label: "DOM nodes", value: a.domNodes != null ? String(a.domNodes) : null },
    { label: "JavaScript errors", value: String(a.jsErrors) },
  ].filter((m) => m.value != null);
  const audits = Object.entries(psi?.audits ?? {}).filter(([k]) => ["uses-optimized-images", "modern-image-formats", "uses-responsive-images", "offscreen-images", "render-blocking-resources", "unused-javascript", "total-byte-weight", "server-response-time", "tap-targets", "font-size", "color-contrast", "errors-in-console"].includes(k));

  return (
    <div className="space-y-5">
      <section className="surface p-5">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 text-[15px] font-medium">
            PageSpeed Insights (mobile) <SourceTag source="pagespeed" />
          </h2>
          {a.psiPerformanceDesktop != null && <span className="font-mono text-[12px] text-muted-foreground">Desktop performance: {a.psiPerformanceDesktop}</span>}
        </header>
        {hasPsi ? (
          <div className="flex flex-wrap gap-8">
            <ScoreRing score={a.psiPerformanceMobile} label="Performance" />
            <ScoreRing score={a.psiAccessibility} label="Accessibility" />
            <ScoreRing score={a.psiBestPractices} label="Best Practices" />
            <ScoreRing score={a.psiSeo} label="SEO" />
          </div>
        ) : (
          <p className="text-[14px] leading-relaxed text-muted-foreground">PageSpeed data unavailable{a.psiError ? ` (${a.psiError})` : ""}. The performance score below is derived from our own timings.</p>
        )}
        {metrics.length > 0 && (
          <dl className="mt-5 grid gap-2 sm:grid-cols-5">
            {metrics.map((m) => (
              <div key={m.label} className="rounded-2xl border border-border px-4 py-3">
                <dt className="eyebrow">{m.label}</dt>
                <dd className={`mt-1 font-mono text-[15px] font-medium tabular-nums ${m.good ? "text-[#1b6a3a]" : "text-destructive"}`}>{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {a.cruxAvailable && <p className="mt-3 text-[12.5px] text-muted-foreground">Chrome UX Report field data is available for this site.</p>}
      </section>

      <section className="surface p-5">
        <h2 className="mb-4 inline-flex items-center gap-2 text-[15px] font-medium">
          Own measurements (Playwright) <SourceTag source="website" />
        </h2>
        <dl className="grid gap-2 sm:grid-cols-4">
          {own.map((m) => (
            <div key={m.label} className="rounded-2xl border border-border px-4 py-3">
              <dt className="eyebrow">{m.label}</dt>
              <dd className="mt-1 font-mono text-[15px] font-medium tabular-nums">{m.value}</dd>
            </div>
          ))}
        </dl>
        {a.jsErrorSamples.length > 0 && (
          <div className="mt-3">
            <div className="eyebrow">Console error samples</div>
            <ul className="mt-1 space-y-1">
              {a.jsErrorSamples.map((e, i) => (
                <li key={i} className="truncate rounded-lg bg-background px-3 py-1.5 font-mono text-[11px]">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {audits.length > 0 && (
        <section className="surface overflow-hidden">
          <header className="border-b border-border px-5 py-3">
            <h2 className="text-[15px] font-medium">Lighthouse audits</h2>
          </header>
          <ul className="divide-y divide-border">
            {audits.map(([k, v]) => (
              <li key={k} className="flex items-center gap-3 px-5 py-2 text-[13.5px]">
                <span className={`size-2.5 rounded-full ${v.score == null ? "bg-foreground/20" : v.score >= 0.9 ? "bg-tint-green" : v.score >= 0.5 ? "bg-tint-yellow" : "bg-destructive"}`} />
                <span className="flex-1">{v.title}</span>
                <span className="font-mono text-[12px] text-muted-foreground">{v.displayValue ?? (v.score != null ? `${Math.round(v.score * 100)}` : "")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
