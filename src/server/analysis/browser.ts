import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import type { BrowserResult, DomMetrics, MobileMetrics, FetchOutcome } from "./types";

let browserPromise: Promise<Browser> | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true, args: ["--disable-dev-shm-usage", "--no-sandbox"] }).then((b) => {
      b.on("disconnected", () => (browserPromise = null));
      return b;
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    await b?.close().catch(() => {});
    browserPromise = null;
  }
}

/** tsx/esbuild `keepNames` wraps functions in `__name(...)`; define it in the page so serialised functions can run. */
const NAME_SHIM = "globalThis.__name = globalThis.__name || ((f) => f);";
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 812 };
const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Loads the page in desktop + mobile viewports, captures screenshots and DOM metrics.
 * Never throws – failures are reported in `error` / `outcome`.
 */
export async function auditWithBrowser(url: string, prospectId: string): Promise<BrowserResult> {
  const result: BrowserResult = {
    ok: false,
    error: null,
    outcome: "ok",
    finalUrl: null,
    html: null,
    screenshotDesktop: null,
    screenshotMobile: null,
    screenshotFull: null,
    jsErrors: 0,
    jsErrorSamples: [],
    mixedContent: false,
    requestsCount: 0,
    failedRequests: 0,
    totalTransferBytes: null,
    ttfbMs: null,
    domContentLoadedMs: null,
    loadMs: null,
    dom: null,
    mobile: null,
    responseHeaders: {},
    cookies: [],
  };
  const dir = path.join(env.storageDir, "screenshots", prospectId);
  await mkdir(dir, { recursive: true });
  const rel = (name: string) => path.join("screenshots", prospectId, name);

  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (err) {
    result.error = `Browser launch failed: ${(err as Error).message}`;
    result.outcome = "error";
    return result;
  }

  // ── Desktop pass ────────────────────────────────────────────────────────────
  let ctx: BrowserContext | null = null;
  try {
    ctx = await browser.newContext({ viewport: DESKTOP, userAgent: DESKTOP_UA, locale: "nl-NL", ignoreHTTPSErrors: true, serviceWorkers: "block" });
    const page = await ctx.newPage();
    let transfer = 0;
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        result.jsErrors++;
        if (result.jsErrorSamples.length < 5) result.jsErrorSamples.push(msg.text().slice(0, 200));
        if (/mixed content/i.test(msg.text())) result.mixedContent = true;
      }
    });
    page.on("pageerror", (err) => {
      result.jsErrors++;
      if (result.jsErrorSamples.length < 5) result.jsErrorSamples.push(String(err.message).slice(0, 200));
    });
    page.on("request", () => result.requestsCount++);
    page.on("requestfailed", () => result.failedRequests++);
    page.on("response", async (res) => {
      const len = Number(res.headers()["content-length"]);
      if (Number.isFinite(len)) transfer += len;
      else {
        try {
          const ct = res.headers()["content-type"] ?? "";
          if (/text|javascript|json|css|image|font/.test(ct) && res.status() === 200) {
            const body = await res.body().catch(() => null);
            if (body) transfer += body.length;
          }
        } catch {
          /* ignore */
        }
      }
      if (url.startsWith("https://") && res.url().startsWith("http://") && !/^http:\/\/(localhost|127\.)/.test(res.url())) result.mixedContent = true;
    });

    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 });
    await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await dismissCookieBanners(page);

    result.finalUrl = page.url();
    if (response) {
      result.responseHeaders = response.headers();
      const status = response.status();
      if (status === 403 || status === 429 || status === 503) {
        const text = (await page.content()).toLowerCase();
        result.outcome = /captcha|cf-chl|challenge-platform|are you a human|verify you are human/.test(text) ? "captcha" : "blocked";
      }
    }
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 5000).toLowerCase() ?? "");
    if (/attention required!|checking your browser|verify you are human|access denied/.test(bodyText) && bodyText.length < 1500) result.outcome = result.outcome === "ok" ? "captcha" : result.outcome;

    result.cookies = (await ctx.cookies()).map((c) => c.name);
    result.html = await page.content();
    result.totalTransferBytes = transfer;

    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return null;
      return { ttfb: nav.responseStart - nav.requestStart, dcl: nav.domContentLoadedEventEnd - nav.startTime, load: nav.loadEventEnd > 0 ? nav.loadEventEnd - nav.startTime : null };
    });
    if (timing) {
      result.ttfbMs = Math.round(timing.ttfb);
      result.domContentLoadedMs = Math.round(timing.dcl);
      result.loadMs = timing.load != null ? Math.round(timing.load) : null;
    }

    await page.evaluate(NAME_SHIM);
    result.dom = await page.evaluate(collectDomMetrics, DESKTOP.height);

    await page.screenshot({ path: path.join(dir, "desktop.jpg"), type: "jpeg", quality: 80 }).then(() => (result.screenshotDesktop = rel("desktop.jpg"))).catch(() => {});
    await page
      .screenshot({ path: path.join(dir, "full.jpg"), type: "jpeg", quality: 60, fullPage: true, timeout: 20_000 })
      .then(() => (result.screenshotFull = rel("full.jpg")))
      .catch(() => {});
    result.ok = true;
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    result.error = msg.slice(0, 300);
    result.outcome = classifyPlaywrightError(msg);
  } finally {
    await ctx?.close().catch(() => {});
  }

  // ── Mobile pass (only when desktop loaded) ───────────────────────────────────
  if (result.ok) {
    let mctx: BrowserContext | null = null;
    try {
      mctx = await browser.newContext({ viewport: MOBILE, userAgent: MOBILE_UA, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "nl-NL", ignoreHTTPSErrors: true, serviceWorkers: "block" });
      const page = await mctx.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("load", { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(800);
      await dismissCookieBanners(page);
      await page.evaluate(NAME_SHIM);
      result.mobile = await page.evaluate(collectMobileMetrics);
      await page.screenshot({ path: path.join(dir, "mobile.jpg"), type: "jpeg", quality: 80 }).then(() => (result.screenshotMobile = rel("mobile.jpg"))).catch(() => {});
    } catch {
      /* mobile pass is best-effort */
    } finally {
      await mctx?.close().catch(() => {});
    }
  }
  return result;
}

function classifyPlaywrightError(msg: string): FetchOutcome {
  const m = msg.toLowerCase();
  if (/timeout/.test(m)) return "timeout";
  if (/err_cert|ssl|certificate/.test(m)) return "ssl_error";
  if (/err_name_not_resolved|err_connection_refused|err_connection_reset|err_address_unreachable|net::err_failed|err_connection_closed/.test(m)) return "offline";
  if (/err_blocked_by_client|err_blocked_by_response|403/.test(m)) return "blocked";
  return "error";
}

async function dismissCookieBanners(page: Page) {
  const selectors = [
    "#onetrust-accept-btn-handler",
    ".cc-btn.cc-dismiss",
    ".cc-allow",
    "button#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    ".cmplz-accept",
    "#cookie_action_close_header",
    ".cky-btn-accept",
    "button[aria-label*='accept' i]",
    "button[id*='accept' i]",
    "button[class*='accept' i]",
    "a[class*='accept' i]",
  ];
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 300 })) {
        await el.click({ timeout: 1000 });
        await page.waitForTimeout(300);
        return;
      }
    } catch {
      /* next */
    }
  }
  try {
    const btn = page.getByRole("button", { name: /^(accepteer|accepteren|akkoord|alles accepteren|accept( all)?|agree|i agree|ok|allow( all)?|got it|alle akzeptieren|akzeptieren)$/i }).first();
    if (await btn.isVisible({ timeout: 300 })) await btn.click({ timeout: 1000 });
  } catch {
    /* none */
  }
}

// Runs inside the page ──────────────────────────────────────────────────────────
function collectDomMetrics(foldY: number): DomMetrics {
  const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const CTA_WORDS = /(offerte|quote|contact|bel |bel ons|call|book|boek|afspraak|appointment|aanvragen|aanvraag|request|get started|start|neem contact|vrijblijvend|prijsopgave|estimate|schedule|reserve|reserveer|bestel|order|buy|koop|inschrijven|sign up|meer info|plan |direct)/i;
  const isVisible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const candidates = [...document.querySelectorAll("a, button, input[type=submit], [role=button]")].filter(isVisible);
  const ctas = candidates.filter((el) => {
    const t = ((el as HTMLElement).innerText || (el as HTMLInputElement).value || el.getAttribute("aria-label") || "").trim();
    if (!t || t.length > 60) return false;
    const cls = (el.className || "").toString().toLowerCase();
    const looksLikeButton = el.tagName === "BUTTON" || el.tagName === "INPUT" || /btn|button|cta/.test(cls) || el.getAttribute("role") === "button";
    return CTA_WORDS.test(t) || (looksLikeButton && t.length > 2);
  });
  const ctaAboveFold = ctas.some((el) => el.getBoundingClientRect().top + window.scrollY < foldY && el.getBoundingClientRect().top >= 0);
  const ctaTexts = [...new Set(ctas.map((el) => ((el as HTMLElement).innerText || (el as HTMLInputElement).value || "").trim()).filter(Boolean))].slice(0, 8);

  const forms = [...document.querySelectorAll("form")].filter((f) => f.querySelectorAll("input:not([type=hidden]), textarea").length >= 2 && !/search|zoek|newsletter|nieuwsbrief/i.test(f.outerHTML.slice(0, 600)));
  const iframes = [...document.querySelectorAll("iframe")].map((i) => i.src || "");
  const hasContactForm = forms.length > 0 || iframes.some((s) => /typeform|jotform|hubspot|forms\.gle|google\.com\/forms|calendly|tally\.so/i.test(s)) || !!document.querySelector(".wpcf7, .gform_wrapper, .wpforms-form, .elementor-form, .hs-form, .fluentform, .nf-form-cont");
  const telLinks = [...document.querySelectorAll("a[href^='tel:']")];
  const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/g;
  const phones = [...new Set([...telLinks.map((a) => a.getAttribute("href")!.replace("tel:", "")), ...(text.match(phoneRegex) ?? []).filter((p) => p.replace(/\D/g, "").length >= 9 && p.replace(/\D/g, "").length <= 14)])].slice(0, 5);
  const phoneVisible = telLinks.some(isVisible) || phones.length > 0;
  const emails = [...new Set([...[...document.querySelectorAll("a[href^='mailto:']")].map((a) => a.getAttribute("href")!.replace(/^mailto:/i, "").split("?")[0].trim()), ...(document.documentElement.innerHTML.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [])])]
    .map((e) => e.toLowerCase())
    .filter((e) => !/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/.test(e) && !/example\.com|sentry|wixpress|schema\.org|@2x|@3x/.test(e) && e.length < 80)
    .slice(0, 10);
  const emailVisible = emails.length > 0;

  const hasReviewsWidget = !!document.querySelector("[class*='trustpilot' i], [class*='google-review' i], [class*='reviews' i], [class*='testimonial' i], [class*='kiyoh' i], [class*='klantenvertellen' i], [class*='feedbackcompany' i], iframe[src*='trustpilot'], iframe[src*='google.com/maps/embed'], [class*='elfsight'], [class*='rating' i]");
  const hasSocialProof = hasReviewsWidget || /(reviews|beoordelingen|klanten vertellen|testimonial|ervaringen|sterren|★|⭐|google rating|trustpilot|kiyoh|feedback company|klantbeoordeling|wat klanten zeggen|what our clients say)/i.test(lower);
  const hasPortfolio = /(portfolio|projecten|projects|onze werken|referenties|cases|case study|gerealiseerd|realisaties|our work|recent work|gallery|galerij|fotos|photos)/i.test(lower) || [...document.querySelectorAll("a")].some((a) => /portfolio|projecten|projects|referenties|cases|galerij|gallery/i.test(a.getAttribute("href") ?? ""));
  const hasTrustSignals = /(kvk|kamer van koophandel|btw|vca|iso 9001|gecertificeerd|certified|erkend|keurmerk|garantie|guarantee|warranty|verzekerd|insured|licensed|bonded|sinds 19|sinds 20|since 19|since 20|jaar ervaring|years of experience|award|lid van|member of|bovag|uneto|techniek nederland|komo|stichting garantiewoning|bouwgarant)/i.test(lower);
  const nav = document.querySelector("nav, [role=navigation], header ul, .menu, .navbar, #menu, .main-navigation");
  const navLinks = nav ? [...nav.querySelectorAll("a")].filter(isVisible).length : 0;
  const hasBookingFlow = /(online (afspraak|boeken|reserveren|booking)|book (online|now|an appointment)|schedule online|calendly|plan (een|je|uw) afspraak|direct boeken|reserveer online)/i.test(lower) || iframes.some((s) => /calendly|booking|acuity|setmore|salonized|treatwell|zenchef|resengo|formitable/i.test(s));
  const hasWhatsApp = !!document.querySelector("a[href*='wa.me'], a[href*='whatsapp'], a[href*='api.whatsapp.com'], [class*='whatsapp' i]");
  const hasChat = !!document.querySelector("[class*='tawk' i], #hubspot-messages-iframe-container, [class*='intercom' i], [class*='crisp' i], [class*='livechat' i], [id*='chat-widget' i], [class*='chat-widget' i], iframe[src*='chat']");
  const hasMapEmbed = iframes.some((s) => /google\.com\/maps|maps\.google|openstreetmap|mapbox/i.test(s)) || !!document.querySelector("[class*='gm-style'], .leaflet-container");
  const addressOnPage = /\b\d{4}\s?[A-Z]{2}\b/.test(text) || /\b[A-Z][a-z]+(straat|laan|weg|plein|singel|kade|dijk|dreef|hof|park|gracht)\s+\d+/i.test(text) || /\b\d{1,5}\s+[A-Z][a-z]+\s(street|st\.|avenue|ave\.|road|rd\.|drive|dr\.|lane|blvd)/i.test(text);

  const heroEl = document.querySelector("h1") ?? document.querySelector("header h2, main h2, .hero h2, h2");
  const heroText = heroEl ? (heroEl as HTMLElement).innerText.replace(/\s+/g, " ").trim().slice(0, 200) || null : null;
  const fontOf = (el: Element | null) => (el ? getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim() : null);
  const fontFamilies = [...new Set([fontOf(document.body), fontOf(document.querySelector("h1")), fontOf(document.querySelector("h2")), fontOf(document.querySelector("p"))].filter(Boolean) as string[])];
  const usesWebFonts = [...document.fonts].some((f) => f.status === "loaded") || !!document.querySelector("link[href*='fonts.googleapis'], link[href*='typekit'], link[href*='fonts.bunny'], style[data-href*='fonts']") || /@font-face/i.test([...document.querySelectorAll("style")].map((s) => s.textContent).join(""));

  const socialLinks: Record<string, string> = {};
  const socialMap: [RegExp, string][] = [[/facebook\.com|fb\.com/i, "facebook"], [/instagram\.com/i, "instagram"], [/linkedin\.com/i, "linkedin"], [/twitter\.com|x\.com\//i, "twitter"], [/youtube\.com|youtu\.be/i, "youtube"], [/tiktok\.com/i, "tiktok"], [/pinterest\./i, "pinterest"]];
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href") ?? "";
    for (const [re, k] of socialMap) if (re.test(href) && !socialLinks[k] && !/share|sharer|intent\/tweet/.test(href)) socialLinks[k] = href;
  }
  const visibleLinks = [...document.querySelectorAll("a[href]")].filter(isVisible).map((a) => (a as HTMLAnchorElement).href).filter((h) => h.startsWith("http")).slice(0, 200);
  const favicon = !!document.querySelector("link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']");

  return {
    hasViewport: !!document.querySelector("meta[name=viewport]"),
    ctaAboveFold,
    ctaCount: ctas.length,
    ctaTexts,
    hasContactForm,
    phoneVisible,
    emailVisible,
    hasSocialProof,
    hasReviewsWidget,
    hasPortfolio,
    hasTrustSignals,
    hasNav: !!nav,
    navLinks,
    hasBookingFlow,
    hasWhatsApp,
    hasChat,
    hasMapEmbed,
    addressOnPage,
    heroText,
    fontFamilies,
    usesWebFonts,
    wordCount: text ? text.split(" ").length : 0,
    bodyText: text.slice(0, 6000),
    visibleLinks,
    socialLinks,
    emails,
    phones,
    domNodes: document.querySelectorAll("*").length,
    hasFavicon: favicon,
  };
}

function collectMobileMetrics(): MobileMetrics {
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 8;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let total = 0;
  let small = 0;
  let n: Node | null;
  while ((n = walker.nextNode()) && total < 1500) {
    const t = n.textContent?.trim();
    if (!t || t.length < 3) continue;
    const el = n.parentElement;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    total++;
    if (size < 12) small++;
  }
  // Percentage of visible controls smaller than 20px in either dimension (WCAG 2.5.8 minimum is 24px; inline text links exempt).
  let tapIssues = 0;
  let tapTotal = 0;
  const targets = [...document.querySelectorAll("a, button, input, select, textarea, [role=button]")];
  for (const el of targets.slice(0, 400)) {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (r.width === 0 || r.height === 0 || st.visibility === "hidden" || st.opacity === "0") continue;
    // Inline text links are exempt from the 24px rule; only count clearly tiny controls.
    const isInlineText = el.tagName === "A" && el.parentElement && ["P", "LI", "SPAN", "TD"].includes(el.parentElement.tagName);
    if (isInlineText) continue;
    tapTotal++;
    if (r.width < 20 || r.height < 20) tapIssues++;
  }
  const tapIssuePct = tapTotal ? Math.round((tapIssues / tapTotal) * 100) : 0;
  const menuPresent = !!document.querySelector("[class*='hamburger' i], [class*='menu-toggle' i], [class*='navbar-toggle' i], [class*='mobile-menu' i], [aria-label*='menu' i], button[aria-controls*='menu' i], .elementor-menu-toggle, [class*='burger' i]") || !!document.querySelector("nav") && [...document.querySelectorAll("nav a")].filter((a) => a.getBoundingClientRect().width > 0).length <= 6;
  return { mobileHorizontalOverflow: overflow, mobileSmallTextRatio: total ? small / total : 0, mobileTapTargetIssues: tapIssuePct, mobileMenuPresent: menuPresent };
}
