/**
 * Dev tool: run the browser audit for a single URL and print the key metrics.
 *   npx tsx --tsconfig tsconfig.json scripts/audit-url.mts https://example.com
 */
import "dotenv/config";
import { auditWithBrowser, closeBrowser } from "@/server/analysis/browser";

const url = process.argv[2] ?? "https://www.hjslierings.nl/";
const r = await auditWithBrowser(url, "_dev-audit");
console.log(
  JSON.stringify(
    {
      ok: r.ok,
      error: r.error,
      outcome: r.outcome,
      shots: [r.screenshotDesktop, r.screenshotMobile, r.screenshotFull],
      dom: r.dom && { cta: r.dom.ctaAboveFold, ctaTexts: r.dom.ctaTexts, phone: r.dom.phoneVisible, form: r.dom.hasContactForm, nav: r.dom.navLinks, hero: r.dom.heroText, fonts: r.dom.fontFamilies, webFonts: r.dom.usesWebFonts, words: r.dom.wordCount, emails: r.dom.emails, socialProof: r.dom.hasSocialProof, trust: r.dom.hasTrustSignals, portfolio: r.dom.hasPortfolio },
      mobile: r.mobile,
      timing: [r.ttfbMs, r.domContentLoadedMs, r.loadMs],
      bytes: r.totalTransferBytes,
      req: r.requestsCount,
      js: r.jsErrors,
    },
    null,
    2,
  ),
);
await closeBrowser();
