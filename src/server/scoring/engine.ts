import type { CheckRecord, IssueRecord, InsightRecord, ScoreBreakdown, ScoresPayload } from "@/lib/types";
import { INDUSTRY_MAP } from "@/lib/industries";
import type { RawAudit } from "@/server/analysis/types";
import { CHECK_WEIGHTS, OPPORTUNITY_WEIGHTS, THRESHOLDS as T, WEBSITE_SCORE_WEIGHTS } from "./weights";

export type BusinessSignals = {
  name: string;
  hasWebsite: boolean;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  hasPhone: boolean;
  hasEmail: boolean;
  industryKey: string | null;
  industry: string;
  source: string;
  city: string | null;
  /** Social profiles found (facebook/instagram/linkedin → url). A business with a
   *  social page but no website is an active business that skipped the website step. */
  socialLinks?: Record<string, string> | null;
};

export type ScoringInput = { audit: RawAudit | null; business: BusinessSignals; aiDesignImpression?: number | null };

export type ScoringOutput = {
  checks: CheckRecord[];
  issues: IssueRecord[];
  insights: InsightRecord[];
  scores: ScoresPayload;
  websiteScore: number | null;
  designScore: number | null;
  uxScore: number | null;
  seoScore: number | null;
  performanceScore: number | null;
  conversionScore: number | null;
  mobileScore: number | null;
  technicalScore: number | null;
  opportunityScore: number;
  priorityLabels: string[];
  issueKeys: string[];
  recommendedService: string;
  ageVerdict: string;
};

type Cat = CheckRecord["category"];
type W = Record<string, number>;

class Collector {
  checks: CheckRecord[] = [];
  issues: IssueRecord[] = [];
  add(category: Cat, key: string, label: string, passed: boolean | null, opts: { value?: string | number | null; source?: CheckRecord["source"]; issue?: Omit<IssueRecord, "key" | "category" | "source" | "label"> & { label?: string; key?: string } } = {}) {
    const weights = CHECK_WEIGHTS[category] as W;
    this.checks.push({ key, label, category, passed, value: opts.value ?? null, source: opts.source ?? "website", weight: weights[key] ?? 1 });
    if (passed === false && opts.issue) {
      this.issues.push({ key: opts.issue.key ?? key, label: opts.issue.label ?? label, severity: opts.issue.severity, category, source: opts.source ?? "website", detail: opts.issue.detail });
    }
  }
  score(category: Cat): number | null {
    const weights = CHECK_WEIGHTS[category] as W;
    let total = 0;
    let got = 0;
    for (const c of this.checks) {
      if (c.category !== category || c.passed === null) continue;
      const w = weights[c.key] ?? 1;
      total += w;
      if (c.passed) got += w;
    }
    // Partial-credit checks store a 0-1 value in `value` when passed === true/false with weight scaling handled by caller via addPartial
    if (total === 0) return null;
    return Math.round((got / total) * 100);
  }
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

function breakdown(score: number | null, components: ScoreBreakdown["components"], note?: string): ScoreBreakdown {
  return { score: score ?? 0, components, note };
}

export function scoreProspect(input: ScoringInput): ScoringOutput {
  const { audit, business } = input;
  const c = new Collector();
  const insights: InsightRecord[] = [];
  const hasWebsite = business.hasWebsite && audit != null;
  const fetched = hasWebsite && audit!.probe.fetchOutcome === "ok" && (audit!.browser?.ok ?? false);

  let websiteScore: number | null = null;
  let technical: number | null = null;
  let seo: number | null = null;
  let ux: number | null = null;
  let conversion: number | null = null;
  let performance: number | null = null;
  let mobile: number | null = null;
  let design: number | null = null;
  let perfDerived = false;
  const ageVerdict = audit?.age.verdict ?? "unknown";

  if (hasWebsite) {
    const a = audit!;
    const p = a.probe;
    const h = a.html;
    const b = a.browser;
    const d = b?.dom ?? null;
    const m = b?.mobile ?? null;
    const psi = a.psiMobile?.performance != null ? a.psiMobile : null;
    const psiD = a.psiDesktop?.performance != null ? a.psiDesktop : null;
    // Content-based categories (UX, conversion, design, mobile, performance) are only
    // meaningful when the real page loaded. Blocked/captcha/error pages are skipped.
    const contentTrusted = p.fetchOutcome === "ok" && b?.ok === true && b.outcome === "ok" && (p.httpStatus == null || p.httpStatus < 400);
    const dTrusted = contentTrusted ? d : null;
    const mTrusted = contentTrusted ? m : null;

    // ── Technical ─────────────────────────────────────────────────────────
    c.add("technical", "https", "HTTPS", p.isHttps, { issue: { key: "no_ssl", label: "No SSL (site served over HTTP)", severity: "critical" } });
    c.add("technical", "ssl_valid", "Valid SSL certificate", p.sslError ? false : p.isHttps ? true : null, { value: p.sslError, issue: { key: "ssl_error", label: "SSL certificate error", severity: "critical", detail: p.sslError ?? undefined } });
    if (!contentTrusted && p.fetchOutcome !== "offline") c.issues.push({ key: "blocked_or_error", label: p.fetchOutcome === "captcha" || p.fetchOutcome === "blocked" ? "Website blocks automated visitors — content checks skipped" : `Website could not be loaded (${p.fetchOutcome})`, severity: "medium", category: "technical", source: "website" });
    c.add("technical", "http_ok", "Homepage returns HTTP 200", p.httpStatus != null ? p.httpStatus >= 200 && p.httpStatus < 400 : null, { value: p.httpStatus, issue: { key: "http_error", label: `Homepage returns HTTP ${p.httpStatus}`, severity: "critical" } });
    if (b?.ok) {
      c.add("technical", "no_mixed_content", "No mixed content", !b.mixedContent, { issue: { key: "mixed_content", label: "Mixed content (insecure resources on HTTPS page)", severity: "high" } });
      c.add("technical", "no_js_errors", "No JavaScript errors", b.jsErrors === 0, { value: b.jsErrors, issue: { key: "js_errors", label: `${b.jsErrors} JavaScript error${b.jsErrors === 1 ? "" : "s"} in console`, severity: b.jsErrors > 3 ? "high" : "medium", detail: b.jsErrorSamples[0] } });
      c.add("technical", "no_failed_requests", "No failed network requests", b.failedRequests <= 1, { value: b.failedRequests, issue: { key: "failed_requests", label: `${b.failedRequests} failed network requests`, severity: "low" } });
      if (b.totalTransferBytes != null) c.add("technical", "page_weight", "Page weight under 2.5 MB", b.totalTransferBytes < T.transferGoodBytes, { value: `${(b.totalTransferBytes / 1_000_000).toFixed(1)} MB`, issue: { key: "heavy_page", label: `Heavy page (${(b.totalTransferBytes / 1_000_000).toFixed(1)} MB transferred)`, severity: b.totalTransferBytes > T.transferPoorBytes ? "high" : "medium" } });
    }
    if (a.links) c.add("technical", "no_broken_links", "No broken internal links", a.links.linksChecked ? a.links.linksBroken / a.links.linksChecked <= T.brokenLinkRatioMax && a.links.linksBroken <= 1 : null, { value: `${a.links.linksBroken}/${a.links.linksChecked}`, issue: { key: "broken_links", label: `${a.links.linksBroken} broken link${a.links.linksBroken === 1 ? "" : "s"} (of ${a.links.linksChecked} checked)`, severity: "medium", detail: a.links.brokenLinks[0] } });
    const hasViewport = h?.hasViewport ?? d?.hasViewport ?? null;
    c.add("technical", "viewport", "Viewport meta tag", hasViewport, { issue: { key: "not_mobile_friendly", label: "No viewport meta tag – not built for mobile", severity: "critical" } });
    c.add("technical", "responsive", "Responsive on 375px", m ? !m.mobileHorizontalOverflow : null, { issue: { key: "not_mobile_friendly", label: "Layout overflows on mobile screens", severity: "critical" } });
    const imgAudit = psi?.audits["uses-optimized-images"] ?? psi?.audits["modern-image-formats"];
    c.add("technical", "image_optimization", "Images optimised", imgAudit ? (imgAudit.score ?? 0) >= 0.9 : null, { source: "pagespeed", value: imgAudit?.displayValue, issue: { key: "unoptimized_images", label: "Images not optimised (PageSpeed)", severity: "medium", detail: imgAudit?.displayValue } });
    const cwv = psi ? (psi.lcpMs != null && psi.lcpMs <= T.lcpGoodMs ? 1 : 0) + (psi.cls != null && psi.cls <= T.clsGood ? 1 : 0) + (psi.tbtMs != null && psi.tbtMs <= T.tbtGoodMs ? 1 : 0) : null;
    c.add("technical", "core_web_vitals", "Core Web Vitals pass (LCP/CLS/TBT)", cwv == null ? null : cwv >= 2, { source: "pagespeed", value: psi ? `LCP ${psi.lcpMs ? (psi.lcpMs / 1000).toFixed(1) : "?"}s · CLS ${psi.cls?.toFixed(2) ?? "?"}` : null, issue: { key: "poor_cwv", label: "Fails Core Web Vitals", severity: "high" } });
    const legacyLibs = (h?.jsLibraries ?? []).filter((l) => (l.name === "jQuery" && l.version?.startsWith("1.")) || (l.name === "Bootstrap" && /^[23]\./.test(l.version ?? "")) || ["MooTools", "Prototype", "AngularJS"].includes(l.name));
    c.add("technical", "modern_stack", "No legacy JavaScript libraries", h ? legacyLibs.length === 0 : null, { value: legacyLibs.map((l) => `${l.name} ${l.version ?? ""}`).join(", "), source: "derived", issue: { key: "legacy_libraries", label: `Legacy libraries: ${legacyLibs.map((l) => `${l.name} ${l.version ?? ""}`.trim()).join(", ")}`, severity: "low" } });

    // ── SEO ───────────────────────────────────────────────────────────────
    if (h) {
      c.add("seo", "title", "Page title present", Boolean(h.title), { value: h.title, issue: { key: "no_title", label: "Missing page title", severity: "critical" } });
      c.add("seo", "title_length", "Title length 20–65 characters", h.title ? h.title.length >= T.titleMin && h.title.length <= T.titleMax : null, { value: h.title?.length, issue: { key: "title_length", label: `Title is ${h.title && h.title.length < T.titleMin ? "too short" : "too long"} (${h.title?.length} chars)`, severity: "low" } });
      c.add("seo", "meta_description", "Meta description present", Boolean(h.metaDescription), { value: h.metaDescription, issue: { key: "no_meta_description", label: "Missing meta description", severity: "high" } });
      c.add("seo", "meta_description_length", "Meta description 50–165 characters", h.metaDescription ? h.metaDescription.length >= T.metaMin && h.metaDescription.length <= T.metaMax : null, { value: h.metaDescription?.length, issue: { key: "meta_length", label: `Meta description length (${h.metaDescription?.length} chars) outside 50–165`, severity: "low" } });
      c.add("seo", "single_h1", "Exactly one H1", h.h1.length === 1, { value: h.h1.length, issue: { key: h.h1.length === 0 ? "no_h1" : "multiple_h1", label: h.h1.length === 0 ? "No H1 heading" : `${h.h1.length} H1 headings`, severity: h.h1.length === 0 ? "high" : "low" } });
      c.add("seo", "heading_structure", "Logical heading structure", h.headingOutline.length ? h.headingSkips === 0 : null, { value: h.headingSkips, issue: { key: "heading_structure", label: `Heading levels skipped ${h.headingSkips}×`, severity: "low" } });
      c.add("seo", "canonical", "Canonical URL", Boolean(h.canonical), { issue: { key: "no_canonical", label: "No canonical tag", severity: "low" } });
      c.add("seo", "sitemap", "sitemap.xml", a.sitemapFound, { issue: { key: "no_sitemap", label: "No sitemap.xml", severity: "medium" } });
      c.add("seo", "robots_txt", "robots.txt", a.robotsTxtFound, { issue: { key: "no_robots", label: "No robots.txt", severity: "low" } });
      c.add("seo", "schema_markup", "Schema.org structured data", h.schemaTypes.length > 0, { value: h.schemaTypes.slice(0, 5).join(", "), issue: { key: "no_schema", label: "No schema markup", severity: "medium" } });
      c.add("seo", "local_business_schema", "LocalBusiness schema", h.hasLocalBusinessSchema, { issue: { key: "no_local_schema", label: "No LocalBusiness schema", severity: "medium" } });
      c.add("seo", "alt_texts", "Alt texts on ≥ 80 % of images", h.imagesTotal ? (h.imagesTotal - h.imagesMissingAlt) / h.imagesTotal >= T.altCoverage : null, { value: `${h.imagesTotal - h.imagesMissingAlt}/${h.imagesTotal}`, issue: { key: "missing_alt", label: `${h.imagesMissingAlt} of ${h.imagesTotal} images without alt text`, severity: "low" } });
      c.add("seo", "indexable", "Indexable (no noindex)", h.isIndexable, { issue: { key: "noindex", label: "Homepage is set to noindex", severity: "critical" } });
      c.add("seo", "open_graph", "Open Graph tags", Object.keys(h.ogTags).length >= 2, { issue: { key: "no_open_graph", label: "No Open Graph tags (poor social sharing)", severity: "low" } });
      c.add("seo", "lang_attribute", "HTML lang attribute", Boolean(h.lang), { value: h.lang, issue: { key: "no_lang", label: "Missing html lang attribute", severity: "low" } });
      const cityInText = business.city ? new RegExp(escapeRe(business.city), "i") : null;
      const localSignals = [d?.addressOnPage, d?.hasMapEmbed, h.hasLocalBusinessSchema, cityInText ? cityInText.test(`${h.title ?? ""} ${h.metaDescription ?? ""} ${d?.heroText ?? ""}`) : false].filter(Boolean).length;
      c.add("seo", "local_seo_signals", "Local SEO signals (address, map, city in title)", localSignals >= 2, { value: localSignals, source: "derived", issue: { key: "weak_local_seo", label: "Weak local SEO signals (no address/map/city in title)", severity: "medium" } });
    }

    // ── UX ────────────────────────────────────────────────────────────────
    if (dTrusted) {
      const d = dTrusted;
      c.add("ux", "navigation", "Navigation menu present", d.hasNav, { issue: { key: "no_navigation", label: "No recognisable navigation", severity: "high" } });
      c.add("ux", "nav_size", "Focused navigation (≤ 9 links)", d.hasNav ? d.navLinks > 0 && d.navLinks <= 9 : null, { value: d.navLinks, issue: { key: "cluttered_nav", label: `Cluttered navigation (${d.navLinks} links)`, severity: "low" } });
      c.add("ux", "headline", "Clear headline (H1) present", Boolean(d.heroText && d.heroText.length > 3), { value: d.heroText, issue: { key: "no_headline", label: "No clear headline above the fold", severity: "medium" } });
      c.add("ux", "cta_present", "Call-to-action present", d.ctaCount > 0, { value: d.ctaCount, issue: { key: "no_cta", label: "No call-to-action buttons", severity: "high" } });
      const contactOptions = [d.phoneVisible, d.emailVisible, d.hasContactForm, d.hasWhatsApp].filter(Boolean).length;
      c.add("ux", "contact_options", "Multiple contact options", contactOptions >= 2, { value: contactOptions, issue: { key: "few_contact_options", label: "Only one (or no) way to get in touch", severity: "medium" } });
      c.add("ux", "readability", "Enough content (≥ 150 words)", d.wordCount >= T.minWords, { value: d.wordCount, issue: { key: "thin_content", label: `Thin content (${d.wordCount} words on homepage)`, severity: "medium" } });
      c.add("ux", "favicon", "Favicon", d.hasFavicon || (h?.hasFavicon ?? false), { issue: { key: "no_favicon", label: "No favicon", severity: "low" } });
    }
    if (mTrusted) {
      const m = mTrusted;
      c.add("ux", "mobile_text_size", "Readable text on mobile", m.mobileSmallTextRatio <= T.smallTextRatioMax, { value: `${Math.round(m.mobileSmallTextRatio * 100)}% small`, issue: { key: "small_mobile_text", label: "Text too small on mobile", severity: "medium" } });
      c.add("ux", "responsive", "Responsive layout", !m.mobileHorizontalOverflow, { issue: { key: "not_mobile_friendly", label: "Layout not responsive", severity: "critical" } });
    }
    const firstImpressionMs = psi?.lcpMs ?? (contentTrusted ? b?.loadMs ?? b?.domContentLoadedMs ?? null : null);
    c.add("ux", "first_impression", "Fast first impression", firstImpressionMs == null ? null : firstImpressionMs <= (psi?.lcpMs != null ? T.lcpGoodMs : T.loadGoodMs), { value: firstImpressionMs != null ? `${(firstImpressionMs / 1000).toFixed(1)}s` : null, source: psi?.lcpMs != null ? "pagespeed" : "derived", issue: { key: "slow_website", label: `Slow first impression (${firstImpressionMs != null ? (firstImpressionMs / 1000).toFixed(1) : "?"}s)`, severity: "high" } });

    // ── Conversion ────────────────────────────────────────────────────────
    if (dTrusted) {
      const d = dTrusted;
      c.add("conversion", "value_proposition", "Clear value proposition in hero", Boolean(d.heroText && d.heroText.split(" ").length >= 4 && !/welkom|welcome|home/i.test(d.heroText)), { value: d.heroText, issue: { key: "no_value_prop", label: "No clear value proposition above the fold", severity: "high" } });
      c.add("conversion", "cta_above_fold", "CTA above the fold", d.ctaAboveFold, { issue: { key: "no_cta", label: "No call-to-action above the fold", severity: "critical" } });
      c.add("conversion", "contact_cta", "Contact / quote CTA", d.ctaTexts.some((t) => /(offerte|quote|contact|bel|call|afspraak|appointment|aanvra|request|estimate|boek|book|reserv)/i.test(t)), { value: d.ctaTexts.slice(0, 3).join(" · "), issue: { key: "no_quote_cta", label: "No clear quote/contact request button", severity: "high" } });
      c.add("conversion", "phone_visible", "Phone number visible", d.phoneVisible, { issue: { key: "no_phone_visible", label: "Phone number not visible on homepage", severity: "medium" } });
      c.add("conversion", "social_proof", "Social proof (reviews/testimonials)", d.hasSocialProof, { issue: { key: "no_social_proof", label: "No social proof on the website", severity: "high" } });
      c.add("conversion", "reviews_widget", "Reviews widget / rating shown", d.hasReviewsWidget, { issue: { key: "no_reviews_widget", label: "Google/Trustpilot reviews not shown on site", severity: "low" } });
      c.add("conversion", "portfolio", "Cases / portfolio", d.hasPortfolio, { issue: { key: "no_portfolio", label: "No projects or portfolio shown", severity: "medium" } });
      c.add("conversion", "trust_signals", "Trust elements (certifications, guarantees, KvK)", d.hasTrustSignals, { issue: { key: "no_trust_signals", label: "No trust elements (certifications, guarantees)", severity: "medium" } });
      c.add("conversion", "contact_form", "Contact form", d.hasContactForm || (h?.hasFormTag ?? false), { issue: { key: "no_contact_form", label: "No contact form", severity: "high" } });
      c.add("conversion", "instant_channel", "Instant channel (WhatsApp/chat/booking)", d.hasWhatsApp || d.hasChat || d.hasBookingFlow, { issue: { key: "no_instant_channel", label: "No WhatsApp, chat or online booking", severity: "low" } });
    }

    // ── Performance ───────────────────────────────────────────────────────
    if (psi) c.add("performance", "psi_mobile", "PageSpeed mobile ≥ 50", psi.performance! >= 50, { value: psi.performance, source: "pagespeed", issue: { key: "slow_website", label: `Poor mobile performance (PageSpeed ${psi.performance})`, severity: psi.performance! < 30 ? "critical" : "high" } });
    if (psiD) c.add("performance", "psi_desktop", "PageSpeed desktop ≥ 70", psiD.performance! >= 70, { value: psiD.performance, source: "pagespeed", issue: { key: "slow_desktop", label: `Poor desktop performance (PageSpeed ${psiD.performance})`, severity: "medium" } });
    if (contentTrusted && b) {
      const ttfb = b.ttfbMs ?? p.responseTimeMs;
      c.add("performance", "ttfb", "Server response (TTFB) under 0.8 s", ttfb != null ? ttfb <= T.ttfbGoodMs : null, { value: ttfb != null ? `${ttfb} ms` : null, source: "derived", issue: { key: "slow_server", label: `Slow server response (${ttfb} ms)`, severity: "medium" } });
      const load = b.loadMs ?? b.domContentLoadedMs;
      c.add("performance", "load_time", "Page load under 3 s", load != null ? load <= T.loadGoodMs : null, { value: load != null ? `${(load / 1000).toFixed(1)}s` : null, source: "derived", issue: { key: "slow_website", label: `Slow page load (${load != null ? (load / 1000).toFixed(1) : "?"}s)`, severity: load != null && load > T.loadPoorMs ? "high" : "medium" } });
      c.add("performance", "transfer_size", "Transfer size under 2.5 MB", b.totalTransferBytes != null ? b.totalTransferBytes < T.transferGoodBytes : null, { value: b.totalTransferBytes != null ? `${(b.totalTransferBytes / 1_000_000).toFixed(1)} MB` : null, source: "derived" });
      perfDerived = !psi;
    }

    // ── Mobile ────────────────────────────────────────────────────────────
    if (contentTrusted) c.add("mobile", "viewport", "Viewport meta tag", hasViewport);
    if (mTrusted) {
      const m = mTrusted;
      c.add("mobile", "no_horizontal_overflow", "No horizontal scrolling on 375px", !m.mobileHorizontalOverflow);
      c.add("mobile", "text_size", "Legible text size", m.mobileSmallTextRatio <= T.smallTextRatioMax);
      c.add("mobile", "tap_targets", "Tap targets large enough", m.mobileTapTargetIssues <= T.tapTargetIssuesMaxPct, { value: `${m.mobileTapTargetIssues}% small`, issue: { key: "small_tap_targets", label: `${m.mobileTapTargetIssues}% of tap targets are too small for touch`, severity: "low" } });
      c.add("mobile", "mobile_menu", "Mobile menu", m.mobileMenuPresent, { issue: { key: "no_mobile_menu", label: "No mobile-friendly menu", severity: "medium" } });
    }
    if (psi && contentTrusted) c.add("mobile", "psi_mobile_perf", "PageSpeed mobile ≥ 50", psi.performance! >= 50, { source: "pagespeed", value: psi.performance });

    // ── Design (measurable + bounded AI impression) ───────────────────────
    if (h && dTrusted) {
      const d = dTrusted;
      c.add("design", "responsive", "Responsive layout", m ? !m.mobileHorizontalOverflow : hasViewport, { source: "derived" });
      c.add("design", "web_fonts", "Web fonts (not system defaults only)", d.usesWebFonts, { source: "derived", issue: { key: "outdated_design", label: "System fonts only – dated typography", severity: "low" } });
      c.add("design", "no_legacy_markup", "No legacy markup", h.legacyMarkup.filter((x) => x !== "no viewport meta").length === 0, { value: h.legacyMarkup.join(", "), source: "derived", issue: { key: "outdated_design", label: `Legacy markup (${h.legacyMarkup.join(", ")})`, severity: "medium" } });
      c.add("design", "modern_libraries", "Modern front-end libraries", legacyLibs.length === 0, { source: "derived" });
      c.add("design", "recent_copyright", "Recent copyright year", h.copyrightYear ? h.copyrightYear >= new Date().getFullYear() - T.copyrightStaleYears : null, { value: h.copyrightYear, source: "derived", issue: { key: "outdated_design", label: `Copyright year ${h.copyrightYear} – site looks unmaintained`, severity: "medium" } });
      c.add("design", "favicon", "Favicon", d.hasFavicon || h.hasFavicon, { source: "derived" });
      c.add("design", "consistent_fonts", "Consistent typography (≤ 3 font families)", d.fontFamilies.length <= 3, { value: d.fontFamilies.join(", "), source: "derived" });
      c.add("design", "hero_present", "Hero headline present", Boolean(d.heroText), { source: "derived" });
      if (input.aiDesignImpression != null) c.add("design", "ai_impression", "AI design impression", input.aiDesignImpression >= 55, { value: input.aiDesignImpression, source: "ai" });
    }

    technical = c.score("technical");
    seo = c.score("seo");
    ux = c.score("ux");
    conversion = c.score("conversion");
    performance = c.score("performance");
    // Without PageSpeed the performance score is derived from a few own timings; cap it so it never looks like a verified 100.
    if (performance != null && !psi) performance = Math.min(performance, T.derivedPerformanceCap);
    mobile = c.score("mobile");
    design = c.score("design");
    // AI impression contributes proportionally (bounded by its weight) – blend numeric value instead of pass/fail
    if (design != null && input.aiDesignImpression != null) {
      const dw = CHECK_WEIGHTS.design;
      const totalW = Object.values(dw).reduce((a, b) => a + b, 0);
      const heuristicW = totalW - dw.ai_impression;
      const heuristicChecks = c.checks.filter((x) => x.category === "design" && x.key !== "ai_impression" && x.passed !== null);
      const hw = heuristicChecks.reduce((s, x) => s + (x.weight ?? 1), 0);
      const hs = heuristicChecks.reduce((s, x) => s + (x.passed ? (x.weight ?? 1) : 0), 0);
      const heuristicScore = hw ? (hs / hw) * 100 : 50;
      design = clamp((heuristicScore * heuristicW + input.aiDesignImpression * dw.ai_impression) / totalW);
    }

    if (contentTrusted) {
      const parts: { key: keyof typeof WEBSITE_SCORE_WEIGHTS; score: number | null }[] = [
        { key: "technical", score: technical },
        { key: "seo", score: seo },
        { key: "ux", score: ux },
        { key: "conversion", score: conversion },
        { key: "performance", score: performance },
      ];
      let tw = 0;
      let ts = 0;
      for (const part of parts) {
        if (part.score == null) continue;
        tw += WEBSITE_SCORE_WEIGHTS[part.key];
        ts += WEBSITE_SCORE_WEIGHTS[part.key] * part.score;
      }
      websiteScore = tw ? clamp(ts / tw) : null;
    } else {
      // Website exists but could not be loaded: technical score reflects that; overall stays low but known.
      websiteScore = technical != null ? clamp(technical * 0.4) : 20;
    }
  }

  // ── Opportunity ─────────────────────────────────────────────────────────
  const industry = business.industryKey ? INDUSTRY_MAP.get(business.industryKey) : undefined;
  const commercial = industry?.commercialWeight ?? 1;
  const rating = business.rating;
  const reviews = business.reviewCount ?? 0;
  const hasGoogleData = business.source === "google_places";

  const poorWebsite = !business.hasWebsite ? 100 : websiteScore == null ? 60 : 100 - websiteScore;
  const ratingScore = rating == null ? (hasGoogleData ? 30 : 50) : rating >= 4.5 ? 100 : rating >= 4.0 ? 70 : rating >= 3.5 ? 40 : 20;
  const reviewScore = hasGoogleData ? clamp((Math.log10(reviews + 1) / Math.log10(251)) * 100) : 50;
  const operational = business.businessStatus == null || business.businessStatus === "OPERATIONAL" ? 100 : 0;
  const businessStrength = clamp((ratingScore * 0.4 + reviewScore * 0.35 + operational * 0.15 + (business.hasPhone ? 100 : 40) * 0.1) * commercial);
  const combo = rating != null && rating >= T.goodBusinessRating && reviews >= T.goodBusinessReviews ? clamp(60 + (Math.min(reviews, 250) / 250) * 40) : rating != null && rating >= 4.0 && reviews >= 10 ? 40 : 0;
  const conversionProblems = !business.hasWebsite ? 100 : conversion == null ? 50 : 100 - conversion;
  const seoOpportunity = !business.hasWebsite ? 80 : seo == null ? 50 : clamp((100 - seo) * (0.7 + Math.min(reviews, 100) / 333));
  const contactability = business.hasEmail ? 100 : business.hasPhone ? 70 : audit?.browser?.dom?.hasContactForm ? 40 : 0;

  const oppComponents = [
    { key: "poorWebsite", label: "Poor website", weight: OPPORTUNITY_WEIGHTS.poorWebsite, score: poorWebsite },
    { key: "businessStrength", label: "Strong existing business", weight: OPPORTUNITY_WEIGHTS.businessStrength, score: businessStrength, note: hasGoogleData ? undefined : "limited data (no Google ratings)" },
    { key: "reviewsRatingCombo", label: "High reviews / rating", weight: OPPORTUNITY_WEIGHTS.reviewsRatingCombo, score: combo },
    { key: "conversionProblems", label: "Conversion problems", weight: OPPORTUNITY_WEIGHTS.conversionProblems, score: conversionProblems },
    { key: "seoOpportunity", label: "SEO opportunity", weight: OPPORTUNITY_WEIGHTS.seoOpportunity, score: seoOpportunity },
    { key: "contactability", label: "Contactability", weight: OPPORTUNITY_WEIGHTS.contactability, score: contactability },
  ];
  let opportunity = clamp(oppComponents.reduce((s, x) => s + x.weight * x.score, 0) / oppComponents.reduce((s, x) => s + x.weight, 0));
  if (business.businessStatus === "CLOSED_PERMANENTLY") opportunity = Math.min(opportunity, 10);
  // Social-only: they maintain a Facebook/Instagram page but have no website. That is an
  // active, reachable business without a site – a slightly stronger lead than "nothing online".
  const socialNetwork = !business.hasWebsite ? (["facebook", "instagram", "linkedin"] as const).find((n) => business.socialLinks?.[n]) ?? null : null;
  if (socialNetwork) opportunity = clamp(opportunity + 5);

  // ── Labels ──────────────────────────────────────────────────────────────
  const labels: string[] = [];
  if (opportunity >= T.hotLead) labels.push("Hot Lead");
  else if (opportunity >= T.highOpportunity) labels.push("High Opportunity");
  if (!business.hasWebsite) labels.push(socialNetwork ? "Social Only" : "No Website");
  if (rating != null && rating >= T.goodBusinessRating && reviews >= T.goodBusinessReviews && (!business.hasWebsite || (websiteScore != null && websiteScore < T.badWebsite))) labels.push("Good Business / Bad Website");
  if (business.hasWebsite && seo != null && seo < T.seoOpportunityBelow) labels.push("SEO Opportunity");
  if (business.hasWebsite && ((design != null && design < T.needsRedesignDesignBelow) || ageVerdict === "likely_outdated")) labels.push("Needs Redesign");
  if (opportunity < T.lowPriority) labels.push("Low Priority");

  // ── Smart insights ──────────────────────────────────────────────────────
  const fmtRating = rating != null ? `${rating.toFixed(1)} rating` : null;
  if (socialNetwork) insights.push({ key: "social_only", text: `Only a ${socialNetwork.charAt(0).toUpperCase() + socialNetwork.slice(1)} page, no website${rating != null ? ` — despite ${fmtRating} and ${reviews} Google reviews` : ""}`, severity: "hot", source: hasGoogleData ? "google_business" : "osm" });
  else if (!business.hasWebsite) insights.push({ key: "no_website", text: `No website found${rating != null ? ` — despite ${fmtRating} and ${reviews} Google reviews` : ""}`, severity: "hot", source: hasGoogleData ? "google_business" : "osm" });
  if (business.hasWebsite && rating != null && rating >= 4.3 && reviews >= 25 && websiteScore != null && websiteScore < 50) insights.push({ key: "good_biz_bad_site", text: `${fmtRating} + ${reviews} reviews + ${ageVerdict === "likely_outdated" ? "outdated" : "weak"} website`, severity: "hot", source: "derived" });
  else if (business.hasWebsite && rating != null && rating >= 4.0 && reviews >= 10 && websiteScore != null && websiteScore < 60) insights.push({ key: "strong_biz_weak_digital", text: "Strong business with weak digital presence", severity: "high", source: "derived" });
  if (business.hasWebsite && reviews >= 20 && seo != null && seo < 45) insights.push({ key: "demand_weak_seo", text: "High local demand but weak SEO", severity: "high", source: "derived" });
  const dom = audit?.browser?.dom;
  if (dom && !dom.ctaAboveFold) insights.push({ key: "no_quote_cta", text: "No clear quote request above the fold", severity: "high", source: "website" });
  if (audit?.browser?.mobile?.mobileHorizontalOverflow || (audit?.html && !audit.html.hasViewport)) insights.push({ key: "not_mobile", text: "Website not mobile friendly", severity: "high", source: "website" });
  if (audit?.psiMobile?.performance != null && audit.psiMobile.performance < 40) insights.push({ key: "slow_mobile", text: `Slow on mobile (PageSpeed ${audit.psiMobile.performance})`, severity: "high", source: "pagespeed" });
  if (dom && !dom.hasContactForm && !dom.emailVisible) insights.push({ key: "phone_only", text: "Contact form missing — leads only via phone", severity: "info", source: "website" });
  if (dom && !dom.hasSocialProof && reviews >= 10) insights.push({ key: "reviews_not_shown", text: `${reviews} Google reviews but none shown on the website`, severity: "info", source: "derived" });
  if (audit && !audit.probe.isHttps) insights.push({ key: "no_ssl", text: "Website has no SSL certificate", severity: "high", source: "website" });
  if (ageVerdict === "likely_outdated") insights.push({ key: "outdated", text: `Likely outdated website (${audit!.age.signals.slice(0, 2).join("; ")})`, severity: "high", source: "derived" });
  if (audit && audit.probe.fetchOutcome !== "ok") insights.push({ key: "unreachable", text: `Website ${audit.probe.fetchOutcome === "offline" ? "appears offline" : audit.probe.fetchOutcome === "timeout" ? "timed out" : audit.probe.fetchOutcome === "ssl_error" ? "has an SSL error" : audit.probe.fetchOutcome === "captcha" || audit.probe.fetchOutcome === "blocked" ? "blocks automated visitors (analysis limited)" : "returned an error"}`, severity: "info", source: "website" });

  // ── Recommended service ─────────────────────────────────────────────────
  let recommended: string;
  if (!business.hasWebsite) recommended = "New website";
  else if (!fetched && audit?.probe.fetchOutcome && ["offline", "ssl_error"].includes(audit.probe.fetchOutcome)) recommended = "Website repair / new website";
  else if ((websiteScore != null && websiteScore < 40) || ageVerdict === "likely_outdated") recommended = "Complete website redesign";
  else if (mobile != null && mobile < 45) recommended = "Mobile redesign";
  else if (performance != null && performance < 40) recommended = "Performance optimization";
  else if (conversion != null && conversion < 45) recommended = "Conversion optimization";
  else if (seo != null && seo < 45 && !(audit?.html?.hasLocalBusinessSchema || dom?.addressOnPage)) recommended = "Local SEO";
  else if (seo != null && seo < 55) recommended = "SEO optimization";
  else if (hasGoogleData && rating != null && rating >= 4.5 && reviews < 15) recommended = "Google Business optimization";
  else if (conversion != null && conversion < 65) recommended = "Landing page";
  else recommended = "No clear need";

  const issues = dedupeIssues(c.issues);
  const scores: ScoresPayload = {
    website: breakdown(websiteScore, Object.entries(WEBSITE_SCORE_WEIGHTS).map(([k, w]) => ({ key: k, label: cap(k), weight: w, score: { technical, seo, ux, conversion, performance }[k as keyof typeof WEBSITE_SCORE_WEIGHTS] ?? null })), !fetched && business.hasWebsite ? "Website could not be fully loaded; score limited to transport checks." : perfDerived ? "Performance derived from own timings (PageSpeed unavailable)." : undefined),
    opportunity: breakdown(opportunity, oppComponents, hasGoogleData ? undefined : "Limited data: no Google rating/reviews available for this source."),
    design: breakdown(design, catComponents(c, "design"), input.aiDesignImpression != null ? "Includes AI design impression (max 36 % weight)." : undefined),
    mobile: breakdown(mobile, catComponents(c, "mobile")),
    technical: breakdown(technical, catComponents(c, "technical")),
    seo: breakdown(seo, catComponents(c, "seo")),
    ux: breakdown(ux, catComponents(c, "ux")),
    conversion: breakdown(conversion, catComponents(c, "conversion")),
    performance: breakdown(performance, catComponents(c, "performance"), perfDerived ? "derived" : undefined),
  };

  return {
    checks: c.checks,
    issues,
    insights,
    scores,
    websiteScore,
    designScore: design,
    uxScore: ux,
    seoScore: seo,
    performanceScore: performance,
    conversionScore: conversion,
    mobileScore: mobile,
    technicalScore: technical,
    opportunityScore: opportunity,
    priorityLabels: labels,
    issueKeys: [...new Set(issues.map((i) => i.key))],
    recommendedService: recommended,
    ageVerdict,
  };
}

function catComponents(c: Collector, cat: Cat) {
  return c.checks.filter((x) => x.category === cat).map((x) => ({ key: x.key, label: x.label, weight: x.weight ?? 1, score: x.passed === null ? null : x.passed ? 100 : 0, note: x.passed === null ? "not measured" : undefined }));
}

function dedupeIssues(issues: IssueRecord[]) {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const map = new Map<string, IssueRecord>();
  for (const i of issues) {
    const existing = map.get(i.key);
    if (!existing || order[i.severity] < order[existing.severity]) map.set(i.key, i);
  }
  return [...map.values()].sort((a, b) => order[a.severity] - order[b.severity]);
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
