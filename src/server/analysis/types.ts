/** Everything measured about a website before scoring. Field names mirror WebsiteAnalysis columns. */
export type FetchOutcome = "ok" | "offline" | "timeout" | "blocked" | "captcha" | "ssl_error" | "error";

export type HttpProbe = {
  url: string;
  finalUrl: string | null;
  domain: string | null;
  httpStatus: number | null;
  isHttps: boolean;
  httpsRedirects: boolean;
  redirectCount: number;
  sslError: string | null;
  responseTimeMs: number | null;
  htmlBytes: number | null;
  fetchError: string | null;
  fetchOutcome: FetchOutcome;
  headers: Record<string, string>;
  html: string | null;
  server: string | null;
};

export type DomMetrics = {
  hasViewport: boolean;
  ctaAboveFold: boolean;
  ctaCount: number;
  ctaTexts: string[];
  hasContactForm: boolean;
  phoneVisible: boolean;
  emailVisible: boolean;
  hasSocialProof: boolean;
  hasReviewsWidget: boolean;
  hasPortfolio: boolean;
  hasTrustSignals: boolean;
  hasNav: boolean;
  navLinks: number;
  hasBookingFlow: boolean;
  hasWhatsApp: boolean;
  hasChat: boolean;
  hasMapEmbed: boolean;
  addressOnPage: boolean;
  heroText: string | null;
  fontFamilies: string[];
  usesWebFonts: boolean;
  wordCount: number;
  bodyText: string;
  visibleLinks: string[];
  socialLinks: Record<string, string>;
  emails: string[];
  phones: string[];
  domNodes: number;
  hasFavicon: boolean;
};

export type MobileMetrics = {
  mobileHorizontalOverflow: boolean;
  mobileSmallTextRatio: number;
  /** Percentage (0-100) of visible tap targets smaller than 24px */
  mobileTapTargetIssues: number;
  mobileMenuPresent: boolean;
};

export type BrowserResult = {
  ok: boolean;
  error: string | null;
  outcome: FetchOutcome;
  finalUrl: string | null;
  html: string | null;
  screenshotDesktop: string | null;
  screenshotMobile: string | null;
  screenshotFull: string | null;
  jsErrors: number;
  jsErrorSamples: string[];
  mixedContent: boolean;
  requestsCount: number;
  failedRequests: number;
  totalTransferBytes: number | null;
  ttfbMs: number | null;
  domContentLoadedMs: number | null;
  loadMs: number | null;
  dom: DomMetrics | null;
  mobile: MobileMetrics | null;
  responseHeaders: Record<string, string>;
  cookies: string[];
};

export type HtmlChecks = {
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  headingOutline: { level: number; text: string }[];
  headingSkips: number;
  canonical: string | null;
  schemaTypes: string[];
  hasLocalBusinessSchema: boolean;
  ogTags: Record<string, string>;
  hasViewport: boolean;
  imagesTotal: number;
  imagesMissingAlt: number;
  isIndexable: boolean;
  lang: string | null;
  hasFavicon: boolean;
  copyrightYear: number | null;
  legacyMarkup: string[];
  jsLibraries: { name: string; version: string | null }[];
  internalLinks: string[];
  externalLinks: string[];
  contactPageUrl: string | null;
  wordCount: number;
  hasFormTag: boolean;
};

export type TechDetection = {
  cms: string | null;
  framework: string | null;
  analytics: string[];
  pixels: string[];
  hosting: string | null;
  server: string | null;
  technologies: { name: string; category: string; evidence: string }[];
};

export type PsiResult = {
  strategy: "mobile" | "desktop";
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  fcpMs: number | null;
  speedIndexMs: number | null;
  audits: Record<string, { score: number | null; displayValue?: string; title: string }>;
  cruxAvailable: boolean;
  fetchedAt: string;
  error?: string;
};

export type LinkCheck = { linksChecked: number; linksBroken: number; brokenLinks: string[] };

export type AgeAssessment = { signals: string[]; verdict: "likely_outdated" | "possibly_outdated" | "modern" | "unknown" };

export type RawAudit = {
  probe: HttpProbe;
  browser: BrowserResult | null;
  html: HtmlChecks | null;
  tech: TechDetection | null;
  psiMobile: PsiResult | null;
  psiDesktop: PsiResult | null;
  links: LinkCheck | null;
  robotsTxtFound: boolean | null;
  sitemapFound: boolean | null;
  age: AgeAssessment;
  emails: string[];
  socialLinks: Record<string, string>;
  durationMs: number;
};
