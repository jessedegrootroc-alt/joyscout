import { env } from "@/lib/env";
import type { PsiResult } from "./types";
import { recordUsage } from "@/server/providers/usage";

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const AUDITS_OF_INTEREST = ["largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time", "first-contentful-paint", "speed-index", "uses-optimized-images", "modern-image-formats", "uses-responsive-images", "offscreen-images", "render-blocking-resources", "unused-javascript", "total-byte-weight", "tap-targets", "font-size", "viewport", "is-crawlable", "document-title", "meta-description", "image-alt", "link-text", "errors-in-console", "is-on-https", "color-contrast", "server-response-time"];

type Raw = {
  lighthouseResult?: {
    categories?: Record<string, { score: number | null }>;
    audits?: Record<string, { score: number | null; numericValue?: number; displayValue?: string; title: string }>;
  };
  loadingExperience?: { metrics?: Record<string, unknown>; overall_category?: string };
  error?: { message: string; code?: number };
};

/** Runs PageSpeed Insights. Returns null when the API is unavailable (quota / error) so scoring can fall back to derived data. */
export async function runPageSpeed(url: string, strategy: "mobile" | "desktop", attempt = 0): Promise<PsiResult | null> {
  const u = new URL(ENDPOINT);
  u.searchParams.set("url", url);
  u.searchParams.set("strategy", strategy);
  for (const c of ["performance", "accessibility", "best-practices", "seo"]) u.searchParams.append("category", c);
  if (env.pagespeedKey) u.searchParams.set("key", env.pagespeedKey);
  let res: Response;
  try {
    res = await fetch(u, { signal: AbortSignal.timeout(90_000) });
    await recordUsage("pagespeed").catch(() => {});
  } catch (err) {
    return { ...empty(strategy), error: `PSI request failed: ${(err as Error).message}` };
  }
  if (res.status === 429) {
    if (attempt < 1 && env.pagespeedKey) {
      await new Promise((r) => setTimeout(r, 4000));
      return runPageSpeed(url, strategy, attempt + 1);
    }
    return { ...empty(strategy), error: "PSI quota exceeded (429)" };
  }
  const data = (await res.json().catch(() => ({}))) as Raw;
  if (!res.ok || data.error) return { ...empty(strategy), error: `PSI error: ${data.error?.message ?? `HTTP ${res.status}`}`.slice(0, 200) };
  const lh = data.lighthouseResult;
  const cat = (k: string) => {
    const s = lh?.categories?.[k]?.score;
    return s == null ? null : Math.round(s * 100);
  };
  const num = (k: string) => lh?.audits?.[k]?.numericValue ?? null;
  const audits: PsiResult["audits"] = {};
  for (const k of AUDITS_OF_INTEREST) {
    const a = lh?.audits?.[k];
    if (a) audits[k] = { score: a.score, displayValue: a.displayValue, title: a.title };
  }
  return {
    strategy,
    performance: cat("performance"),
    accessibility: cat("accessibility"),
    bestPractices: cat("best-practices"),
    seo: cat("seo"),
    lcpMs: num("largest-contentful-paint"),
    cls: num("cumulative-layout-shift"),
    tbtMs: num("total-blocking-time"),
    fcpMs: num("first-contentful-paint"),
    speedIndexMs: num("speed-index"),
    audits,
    cruxAvailable: Boolean(data.loadingExperience?.metrics && Object.keys(data.loadingExperience.metrics).length),
    fetchedAt: new Date().toISOString(),
  };
}

function empty(strategy: "mobile" | "desktop"): PsiResult {
  return { strategy, performance: null, accessibility: null, bestPractices: null, seo: null, lcpMs: null, cls: null, tbtMs: null, fcpMs: null, speedIndexMs: null, audits: {}, cruxAvailable: false, fetchedAt: new Date().toISOString() };
}
