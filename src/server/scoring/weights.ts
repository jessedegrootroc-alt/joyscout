/**
 * All scoring weights live here. Adjust freely; the engine normalises weights
 * per category so they don't need to sum to 100.
 */
export const WEBSITE_SCORE_WEIGHTS = {
  technical: 25,
  seo: 20,
  ux: 20,
  conversion: 20,
  performance: 15,
} as const;

export const OPPORTUNITY_WEIGHTS = {
  poorWebsite: 30,
  businessStrength: 25,
  reviewsRatingCombo: 15,
  conversionProblems: 15,
  seoOpportunity: 10,
  contactability: 5,
} as const;

/** Per-check weights inside each category (relative). */
export const CHECK_WEIGHTS = {
  technical: {
    https: 5,
    ssl_valid: 4,
    http_ok: 4,
    no_mixed_content: 2,
    no_broken_links: 3,
    no_js_errors: 2,
    no_failed_requests: 1,
    page_weight: 2,
    viewport: 3,
    responsive: 4,
    image_optimization: 2,
    core_web_vitals: 3,
    modern_stack: 2,
  },
  seo: {
    title: 4,
    title_length: 1,
    meta_description: 4,
    meta_description_length: 1,
    single_h1: 3,
    heading_structure: 2,
    canonical: 2,
    sitemap: 2,
    robots_txt: 1,
    schema_markup: 3,
    local_business_schema: 3,
    alt_texts: 2,
    indexable: 4,
    open_graph: 1,
    lang_attribute: 1,
    local_seo_signals: 3,
  },
  ux: {
    navigation: 4,
    nav_size: 1,
    headline: 3,
    cta_present: 3,
    contact_options: 3,
    readability: 2,
    mobile_text_size: 2,
    responsive: 4,
    first_impression: 3,
    favicon: 1,
  },
  conversion: {
    value_proposition: 3,
    cta_above_fold: 5,
    contact_cta: 3,
    phone_visible: 3,
    social_proof: 4,
    reviews_widget: 2,
    portfolio: 2,
    trust_signals: 2,
    contact_form: 4,
    instant_channel: 2,
  },
  performance: {
    psi_mobile: 7,
    psi_desktop: 3,
    ttfb: 2,
    load_time: 2,
    transfer_size: 1,
  },
  mobile: {
    viewport: 4,
    no_horizontal_overflow: 5,
    text_size: 3,
    tap_targets: 2,
    mobile_menu: 2,
    psi_mobile_perf: 4,
  },
  design: {
    responsive: 4,
    web_fonts: 2,
    no_legacy_markup: 3,
    modern_libraries: 3,
    recent_copyright: 2,
    favicon: 1,
    consistent_fonts: 1,
    hero_present: 2,
    ai_impression: 10, // only counted when AI ran; capped at 40 % of design by construction (10 / 28)
  },
} as const;

/** Thresholds used by the engine. */
export const THRESHOLDS = {
  titleMin: 20,
  titleMax: 65,
  metaMin: 50,
  metaMax: 165,
  altCoverage: 0.8,
  minWords: 150,
  lcpGoodMs: 2500,
  lcpPoorMs: 4000,
  clsGood: 0.1,
  tbtGoodMs: 200,
  ttfbGoodMs: 800,
  loadGoodMs: 3000,
  loadPoorMs: 6000,
  transferGoodBytes: 2_500_000,
  transferPoorBytes: 5_000_000,
  smallTextRatioMax: 0.15,
  tapTargetIssuesMaxPct: 25,
  brokenLinkRatioMax: 0.1,
  copyrightStaleYears: 2,
  /** Max performance score when PageSpeed data is unavailable (derived from own timings only) */
  derivedPerformanceCap: 80,
  hotLead: 80,
  highOpportunity: 65,
  lowPriority: 35,
  goodBusinessRating: 4.3,
  goodBusinessReviews: 25,
  badWebsite: 50,
  seoOpportunityBelow: 45,
  needsRedesignDesignBelow: 45,
} as const;

/** Prospects below this pre-AI opportunity score skip the paid AI analysis (default, overridable per user). */
export const DEFAULT_AI_MIN_OPPORTUNITY = 40;

/** How long an analysis stays valid before the pipeline re-analyses the same domain. */
export const ANALYSIS_TTL_DAYS = 7;
