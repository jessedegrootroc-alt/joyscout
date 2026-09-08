import { prisma } from "@/lib/prisma";
import { COUNTRIES } from "@/lib/industries";
import { probeUrl, existsAtPath } from "@/server/analysis/fetch";
import { auditWithBrowser } from "@/server/analysis/browser";
import { analyzeHtml } from "@/server/analysis/html";
import { detectTech, platformFromTech } from "@/server/analysis/tech-detect";
import { runPageSpeed } from "@/server/analysis/psi";
import { extractEmails, extractSocial, fetchContactPage } from "@/server/analysis/contact";
import { checkLinks } from "@/server/analysis/links";
import { assessAge } from "@/server/analysis/age";
import type { RawAudit } from "@/server/analysis/types";
import { scoreProspect, type BusinessSignals } from "@/server/scoring/engine";
import { ANALYSIS_TTL_DAYS, DEFAULT_AI_MIN_OPPORTUNITY } from "@/server/scoring/weights";
import { isAiConfigured } from "@/server/ai/llm";
import { runAiAnalysis } from "@/server/ai/analyze";
import { env } from "@/lib/env";
import { logActivity } from "@/server/prospects/activity";
import { finalizeScanIfDone } from "./discover";
import { normalizePhone } from "@/server/providers/normalize";

export type AnalyzeOptions = { prospectId: string; scanId?: string; force?: boolean; runAi?: boolean };

async function setStage(prospectId: string, scanId: string | undefined, stage: string) {
  if (!scanId) return;
  await prisma.scanProspect.updateMany({ where: { scanId, prospectId }, data: { stage, status: "ANALYZING" } }).catch(() => {});
}

/** Full website audit for one prospect. Never lets one failure kill the scan. */
export async function analyzeProspect(opts: AnalyzeOptions) {
  const { prospectId, scanId } = opts;
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId }, include: { analysis: { select: { fetchedAt: true, id: true, fetchOutcome: true } } } });
  if (!prospect) return;

  if (scanId) {
    const scan = await prisma.scan.findUnique({ where: { id: scanId }, select: { status: true } });
    if (!scan || scan.status === "CANCELLED") {
      await prisma.scanProspect.updateMany({ where: { scanId, prospectId }, data: { status: "SKIPPED", stage: "Cancelled" } });
      return;
    }
  }

  if (!prospect.website) {
    await prisma.prospect.update({ where: { id: prospectId }, data: { analysisStatus: "NO_WEBSITE" } });
    if (scanId) {
      await prisma.scanProspect.updateMany({ where: { scanId, prospectId }, data: { status: "NO_WEBSITE", stage: "No website" } });
      await finalizeScanIfDone(scanId);
    }
    return;
  }

  // Cache: recent analysis for this prospect → reuse (cost control)
  const ttl = ANALYSIS_TTL_DAYS * 86_400_000;
  // Only reuse analyses that actually loaded the site; transient failures (timeouts, blocks) are retried.
  if (!opts.force && prospect.analysis && prospect.analysis.fetchOutcome === "ok" && Date.now() - prospect.analysis.fetchedAt.getTime() < ttl && prospect.analysisStatus === "COMPLETED") {
    if (scanId) {
      await prisma.scanProspect.updateMany({ where: { scanId, prospectId }, data: { status: "COMPLETED", stage: "Reused recent analysis" } });
      await finalizeScanIfDone(scanId);
    }
    return;
  }

  const started = Date.now();
  await prisma.prospect.update({ where: { id: prospectId }, data: { analysisStatus: "ANALYZING", analysisError: null } });
  await setStage(prospectId, scanId, "Fetching website");

  try {
    // 1. HTTP probe
    const probe = await probeUrl(prospect.website);
    const reachable = probe.fetchOutcome === "ok" || probe.fetchOutcome === "blocked" || probe.fetchOutcome === "captcha";

    // 2. Browser audit (screenshots + DOM), only when the host resolved
    await setStage(prospectId, scanId, "Capturing screenshots");
    const browser = probe.fetchOutcome === "offline" ? null : await auditWithBrowser(probe.finalUrl ?? prospect.website, prospectId);
    const html = browser?.html ?? probe.html;
    const pageUrl = browser?.finalUrl ?? probe.finalUrl ?? prospect.website;

    // 3. HTML + tech checks
    await setStage(prospectId, scanId, "Running SEO checks");
    const htmlChecks = html ? analyzeHtml(html, pageUrl) : null;
    const tech = html ? detectTech(html, { ...probe.headers, ...(browser?.responseHeaders ?? {}) }, browser?.cookies ?? []) : null;

    // 4. robots / sitemap / contact discovery / links (parallel, best effort)
    const origin = safeOrigin(pageUrl);
    const [robotsTxtFound, sitemapFound, contactHtml, links] = await Promise.all([
      origin && reachable ? existsAtPath(origin, "/robots.txt") : Promise.resolve(null),
      origin && reachable ? existsAtPath(origin, "/sitemap.xml") : Promise.resolve(null),
      htmlChecks?.contactPageUrl && reachable ? fetchContactPage(htmlChecks.contactPageUrl) : Promise.resolve(null),
      htmlChecks && reachable ? checkLinks(htmlChecks.internalLinks) : Promise.resolve(null),
    ]);
    const emails = uniq([...(browser?.dom?.emails ?? []), ...(html ? extractEmails(html, probe.domain) : []), ...(contactHtml ? extractEmails(contactHtml, probe.domain) : [])]).filter((e) => !probe.domain || !/wixpress|sentry|example/.test(e));
    const socialLinks = { ...(html ? extractSocial(html) : {}), ...(browser?.dom?.socialLinks ?? {}), ...(contactHtml ? extractSocial(contactHtml) : {}), ...((prospect.socialLinks as Record<string, string> | null) ?? {}) };

    // 5. PageSpeed (verified external data) – skip when unreachable
    await setStage(prospectId, scanId, "Running performance test");
    let psiMobile = null;
    let psiDesktop = null;
    if (probe.fetchOutcome === "ok") {
      psiMobile = await runPageSpeed(pageUrl, "mobile");
      if (env.pagespeedKey && psiMobile && !psiMobile.error) psiDesktop = await runPageSpeed(pageUrl, "desktop");
    }

    // 6. Age + scoring
    await setStage(prospectId, scanId, "Calculating scores");
    const age = assessAge({ html: htmlChecks, dom: browser?.dom ?? null, mobile: browser?.mobile ?? null, probe });
    const audit: RawAudit = { probe, browser, html: htmlChecks, tech, psiMobile, psiDesktop, links, robotsTxtFound, sitemapFound, age, emails, socialLinks, durationMs: Date.now() - started };

    const bestEmail = prospect.email ?? emails[0] ?? null;
    const bestPhone = prospect.phone ?? browser?.dom?.phones[0] ?? null;
    const business: BusinessSignals = { name: prospect.name, hasWebsite: true, rating: prospect.googleRating, reviewCount: prospect.googleReviewCount, businessStatus: prospect.businessStatus, hasPhone: Boolean(bestPhone), hasEmail: Boolean(bestEmail), industryKey: prospect.industryKey, industry: prospect.industry, source: prospect.source, city: prospect.city };
    let scoring = scoreProspect({ audit, business });

    // 7. AI analysis (cost-gated)
    const settings = await prisma.userSettings.findUnique({ where: { userId: prospect.userId } });
    const threshold = settings?.aiMinOpportunity ?? DEFAULT_AI_MIN_OPPORTUNITY;
    let ai: { status: string; model?: string; data?: Awaited<ReturnType<typeof runAiAnalysis>>["data"]; error?: string } = { status: "not_configured" };
    const shouldRunAi = isAiConfigured() && probe.fetchOutcome === "ok" && browser?.ok && (opts.runAi || scoring.opportunityScore >= threshold);
    if (isAiConfigured() && !shouldRunAi) ai = { status: "skipped" };
    if (shouldRunAi) {
      await setStage(prospectId, scanId, "AI analysis");
      try {
        const language = COUNTRIES.find((c) => c.code === (prospect.countryCode ?? "NL"))?.lang === "nl" ? "nl" : "en";
        const res = await runAiAnalysis({
          business: { name: prospect.name, industry: prospect.industry, city: prospect.city, countryCode: prospect.countryCode, rating: prospect.googleRating, reviewCount: prospect.googleReviewCount, website: prospect.website, phone: bestPhone, email: bestEmail },
          scores: { website: scoring.websiteScore, technical: scoring.technicalScore, seo: scoring.seoScore, ux: scoring.uxScore, conversion: scoring.conversionScore, performance: scoring.performanceScore, mobile: scoring.mobileScore, design: scoring.designScore, opportunity: scoring.opportunityScore },
          checks: scoring.checks,
          issues: scoring.issues,
          insights: scoring.insights,
          facts: {
            title: htmlChecks?.title,
            metaDescription: htmlChecks?.metaDescription,
            h1: htmlChecks?.h1,
            heroText: browser?.dom?.heroText,
            ctaTexts: browser?.dom?.ctaTexts,
            navLinks: browser?.dom?.navLinks,
            wordCount: browser?.dom?.wordCount,
            fontFamilies: browser?.dom?.fontFamilies,
            usesWebFonts: browser?.dom?.usesWebFonts,
            copyrightYear: htmlChecks?.copyrightYear,
            cms: tech?.cms,
            framework: tech?.framework,
            analytics: tech?.analytics,
            ageSignals: age.signals,
            ageVerdict: age.verdict,
            psiMobilePerformance: psiMobile?.performance,
            lcpMs: psiMobile?.lcpMs,
            loadMs: browser?.loadMs,
            transferMB: browser?.totalTransferBytes ? +(browser.totalTransferBytes / 1e6).toFixed(1) : null,
            homepageTextExcerpt: browser?.dom?.bodyText.slice(0, 1500),
            emailsFound: emails.slice(0, 3),
            socialLinks: Object.keys(socialLinks),
          },
          language,
        });
        ai = { status: "completed", model: res.model, data: res.data };
        // Re-score with bounded AI design impression
        scoring = scoreProspect({ audit, business, aiDesignImpression: res.data.designImpression });
      } catch (err) {
        ai = { status: "failed", error: (err as Error).message.slice(0, 300) };
        console.error("[analyze] AI failed", err);
      }
    }

    // 8. Store
    const d = browser?.dom;
    const m = browser?.mobile;
    const analysisData = {
      url: prospect.website,
      finalUrl: pageUrl,
      domain: probe.domain,
      fetchedAt: new Date(),
      durationMs: Date.now() - started,
      httpStatus: probe.httpStatus,
      isHttps: probe.isHttps,
      httpsRedirects: probe.httpsRedirects,
      redirectCount: probe.redirectCount,
      sslError: probe.sslError,
      responseTimeMs: probe.responseTimeMs,
      htmlBytes: probe.htmlBytes,
      fetchError: probe.fetchError ?? browser?.error ?? null,
      fetchOutcome: probe.fetchOutcome === "ok" && browser && !browser.ok ? browser.outcome : probe.fetchOutcome,
      screenshotDesktop: browser?.screenshotDesktop ?? null,
      screenshotMobile: browser?.screenshotMobile ?? null,
      screenshotFull: browser?.screenshotFull ?? null,
      title: htmlChecks?.title ?? null,
      metaDescription: htmlChecks?.metaDescription ?? null,
      h1: htmlChecks?.h1 ?? [],
      headingOutline: htmlChecks?.headingOutline ?? undefined,
      canonical: htmlChecks?.canonical ?? null,
      robotsTxtFound,
      sitemapFound,
      schemaTypes: htmlChecks?.schemaTypes ?? [],
      hasLocalBusinessSchema: htmlChecks?.hasLocalBusinessSchema ?? false,
      ogTags: htmlChecks?.ogTags ?? undefined,
      hasViewport: htmlChecks?.hasViewport ?? d?.hasViewport ?? false,
      imagesTotal: htmlChecks?.imagesTotal ?? 0,
      imagesMissingAlt: htmlChecks?.imagesMissingAlt ?? 0,
      isIndexable: htmlChecks?.isIndexable ?? true,
      lang: htmlChecks?.lang ?? null,
      wordCount: d?.wordCount ?? htmlChecks?.wordCount ?? 0,
      hasFavicon: d?.hasFavicon ?? htmlChecks?.hasFavicon ?? false,
      linksInternal: htmlChecks?.internalLinks.length ?? 0,
      linksExternal: htmlChecks?.externalLinks.length ?? 0,
      linksChecked: links?.linksChecked ?? 0,
      linksBroken: links?.linksBroken ?? 0,
      brokenLinks: links?.brokenLinks ?? [],
      ctaAboveFold: d?.ctaAboveFold ?? false,
      ctaCount: d?.ctaCount ?? 0,
      ctaTexts: d?.ctaTexts ?? [],
      hasContactForm: d?.hasContactForm ?? htmlChecks?.hasFormTag ?? false,
      phoneVisible: d?.phoneVisible ?? false,
      emailVisible: d?.emailVisible ?? false,
      hasSocialProof: d?.hasSocialProof ?? false,
      hasReviewsWidget: d?.hasReviewsWidget ?? false,
      hasPortfolio: d?.hasPortfolio ?? false,
      hasTrustSignals: d?.hasTrustSignals ?? false,
      hasNav: d?.hasNav ?? false,
      navLinks: d?.navLinks ?? 0,
      hasBookingFlow: d?.hasBookingFlow ?? false,
      hasWhatsApp: d?.hasWhatsApp ?? false,
      hasChat: d?.hasChat ?? false,
      hasMapEmbed: d?.hasMapEmbed ?? false,
      addressOnPage: d?.addressOnPage ?? false,
      heroText: d?.heroText ?? null,
      copyrightYear: htmlChecks?.copyrightYear ?? null,
      fontFamilies: d?.fontFamilies ?? [],
      usesWebFonts: d?.usesWebFonts ?? false,
      legacyMarkup: htmlChecks?.legacyMarkup ?? [],
      mobileHorizontalOverflow: m?.mobileHorizontalOverflow ?? null,
      mobileSmallTextRatio: m?.mobileSmallTextRatio ?? null,
      mobileTapTargetIssues: m?.mobileTapTargetIssues ?? null,
      mobileMenuPresent: m?.mobileMenuPresent ?? null,
      jsErrors: browser?.jsErrors ?? 0,
      jsErrorSamples: browser?.jsErrorSamples ?? [],
      mixedContent: browser?.mixedContent ?? false,
      requestsCount: browser?.requestsCount ?? 0,
      totalTransferBytes: browser?.totalTransferBytes ?? null,
      domNodes: d?.domNodes ?? null,
      ttfbMs: browser?.ttfbMs ?? probe.responseTimeMs,
      domContentLoadedMs: browser?.domContentLoadedMs ?? null,
      loadMs: browser?.loadMs ?? null,
      failedRequests: browser?.failedRequests ?? 0,
      cms: tech?.cms ?? null,
      framework: tech?.framework ?? null,
      analytics: tech?.analytics ?? [],
      pixels: tech?.pixels ?? [],
      hosting: tech?.hosting ?? null,
      server: tech?.server ?? probe.server,
      jsLibraries: htmlChecks?.jsLibraries ?? undefined,
      technologies: tech?.technologies ?? undefined,
      psiMobile: psiMobile ?? undefined,
      psiDesktop: psiDesktop ?? undefined,
      psiPerformanceMobile: psiMobile?.performance ?? null,
      psiPerformanceDesktop: psiDesktop?.performance ?? null,
      psiAccessibility: psiMobile?.accessibility ?? null,
      psiBestPractices: psiMobile?.bestPractices ?? null,
      psiSeo: psiMobile?.seo ?? null,
      psiError: psiMobile?.error ?? null,
      lcpMs: psiMobile?.lcpMs ?? null,
      cls: psiMobile?.cls ?? null,
      tbtMs: psiMobile?.tbtMs ?? null,
      fcpMs: psiMobile?.fcpMs ?? null,
      speedIndexMs: psiMobile?.speedIndexMs ?? null,
      cruxAvailable: psiMobile?.cruxAvailable ?? false,
      ageSignals: age.signals,
      ageVerdict: age.verdict,
      checks: scoring.checks,
      issues: scoring.issues,
      scores: scoring.scores,
      insights: scoring.insights,
      rawAudit: stripAudit(audit),
      aiStatus: ai.status,
      aiModel: ai.model ?? null,
      aiSummary: ai.data?.summary ?? null,
      aiStrengths: ai.data?.strengths ?? undefined,
      aiIssues: ai.data?.issues ?? undefined,
      aiOpportunities: ai.data?.opportunities ?? undefined,
      aiRecommendedService: ai.data?.recommendedService ?? null,
      aiDesignImpression: ai.data?.designImpression ?? null,
      aiError: ai.error ?? null,
      aiAnalyzedAt: ai.status === "completed" ? new Date() : null,
    };
    await prisma.websiteAnalysis.upsert({ where: { prospectId }, create: { prospectId, ...analysisData } as never, update: analysisData as never });

    await prisma.prospect.update({
      where: { id: prospectId },
      data: {
        email: bestEmail,
        emailSource: prospect.email ? prospect.emailSource : emails[0] ? "website" : null,
        phone: bestPhone,
        phoneNormalized: prospect.phoneNormalized ?? normalizePhone(bestPhone, prospect.countryCode),
        socialLinks: Object.keys(socialLinks).length ? socialLinks : undefined,
        domain: probe.domain ?? prospect.domain,
        websiteScore: scoring.websiteScore,
        designScore: scoring.designScore,
        uxScore: scoring.uxScore,
        seoScore: scoring.seoScore,
        performanceScore: scoring.performanceScore,
        conversionScore: scoring.conversionScore,
        mobileScore: scoring.mobileScore,
        technicalScore: scoring.technicalScore,
        opportunityScore: scoring.opportunityScore,
        platform: platformFromTech(tech),
        recommendedService: ai.data?.recommendedService && scoring.websiteScore != null && scoring.websiteScore >= 40 ? ai.data.recommendedService : scoring.recommendedService,
        priorityLabels: scoring.priorityLabels,
        insights: scoring.insights.map((i) => i.text),
        issueKeys: scoring.issueKeys,
        ageVerdict: scoring.ageVerdict,
        analysisStatus: "COMPLETED",
        analysisError: null,
        lastAnalyzedAt: new Date(),
      },
    });
    await logActivity(prospectId, prospect.userId, "ANALYZED", `Website analysed — Website Score ${scoring.websiteScore ?? "n/a"}, Opportunity ${scoring.opportunityScore}${ai.status === "completed" ? ", AI analysis included" : ""}`, { scanId, fetchOutcome: probe.fetchOutcome });

    if (scanId) await prisma.scanProspect.updateMany({ where: { scanId, prospectId }, data: { status: "COMPLETED", stage: "Done" } });
  } catch (err) {
    const message = (err as Error).message?.slice(0, 400) ?? String(err);
    console.error(`[analyze] ${prospect.website} failed:`, message);
    await prisma.prospect.update({ where: { id: prospectId }, data: { analysisStatus: "FAILED", analysisError: message } });
    if (scanId) await prisma.scanProspect.updateMany({ where: { scanId, prospectId }, data: { status: "FAILED", stage: "Failed", error: message } });
  } finally {
    if (scanId) await finalizeScanIfDone(scanId);
  }
}

/** Removes bulky HTML/text so the raw audit can be stored for re-scoring. */
export function stripAudit(audit: RawAudit) {
  return {
    ...audit,
    probe: { ...audit.probe, html: null },
    browser: audit.browser ? { ...audit.browser, html: null, dom: audit.browser.dom ? { ...audit.browser.dom, bodyText: audit.browser.dom.bodyText.slice(0, 1500), visibleLinks: [] } : null } : null,
    html: audit.html ? { ...audit.html, internalLinks: audit.html.internalLinks.slice(0, 20), externalLinks: audit.html.externalLinks.slice(0, 20) } : null,
  };
}

function uniq<T>(arr: T[]) {
  return [...new Set(arr)];
}
function safeOrigin(u: string) {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
}
