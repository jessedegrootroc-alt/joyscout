import { z } from "zod";

export const scanFiltersSchema = z.object({
  minReviews: z.number().int().min(0).max(10000).optional(),
  minRating: z.number().min(0).max(5).optional(),
  /** "any" | "yes" | "no" – whether the business must have / must not have a website */
  websiteRequired: z.enum(["any", "yes", "no"]).default("any"),
  /** Result view filters (applied after analysis) */
  maxWebsiteScore: z.number().int().min(0).max(100).optional(),
  minOpportunityScore: z.number().int().min(0).max(100).optional(),
});
export type ScanFilters = z.infer<typeof scanFiltersSchema>;

export const scanInputSchema = z.object({
  query: z.string().trim().min(2).max(80),
  industryKey: z.string().trim().max(60).nullable().optional(),
  location: z.string().trim().min(2).max(120),
  countryCode: z.string().length(2).default("NL"),
  radiusKm: z.number().int().min(1).max(50).default(25),
  maxResults: z.number().int().min(10).max(200).default(60),
  filters: scanFiltersSchema.default({ websiteRequired: "any" }),
  name: z.string().trim().max(120).optional(),
  saveSearch: z.boolean().optional(),
});
export type ScanInput = z.infer<typeof scanInputSchema>;

export const LEAD_STATUSES = [
  "NEW",
  "QUALIFIED",
  "CONTACTED",
  "REPLIED",
  "FOLLOW_UP",
  "MEETING_BOOKED",
  "WON",
  "LOST",
  "NOT_INTERESTED",
] as const;
export type LeadStatusKey = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatusKey, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  CONTACTED: "Contacted",
  REPLIED: "Replied",
  FOLLOW_UP: "Follow-up",
  MEETING_BOOKED: "Meeting booked",
  WON: "Won",
  LOST: "Lost",
  NOT_INTERESTED: "Not interested",
};

export const PLATFORMS = ["WordPress", "Wix", "Squarespace", "Shopify", "Webflow", "Joomla", "Drupal", "Jimdo", "Custom", "Unknown"] as const;

/** Issue keys the filter UI exposes (must match keys produced by the scoring engine). */
export const ISSUE_FILTERS: { key: string; label: string }[] = [
  { key: "no_ssl", label: "No SSL" },
  { key: "slow_website", label: "Slow website" },
  { key: "no_cta", label: "No CTA" },
  { key: "not_mobile_friendly", label: "No mobile optimization" },
  { key: "no_meta_description", label: "No meta description" },
  { key: "no_h1", label: "No H1" },
  { key: "outdated_design", label: "Old design" },
  { key: "no_social_proof", label: "No social proof" },
  { key: "no_contact_form", label: "No contact form" },
  { key: "no_schema", label: "No schema markup" },
  { key: "broken_links", label: "Broken links" },
  { key: "js_errors", label: "JavaScript errors" },
];

export const OUTREACH_CHANNELS = ["EMAIL", "LINKEDIN", "WHATSAPP", "PHONE", "INSTAGRAM"] as const;
export const OUTREACH_TONES = ["friendly", "direct", "professional", "casual"] as const;
export const OUTREACH_LENGTHS = ["short", "medium", "long"] as const;

export type CheckRecord = {
  key: string;
  label: string;
  category: "technical" | "seo" | "ux" | "conversion" | "performance" | "mobile" | "design";
  passed: boolean | null; // null = not measured
  value?: string | number | null;
  source: DataSource;
  weight?: number;
};

export type IssueRecord = {
  key: string;
  label: string;
  severity: "critical" | "high" | "medium" | "low";
  category: CheckRecord["category"] | "business";
  source: DataSource;
  detail?: string;
};

export type InsightRecord = {
  key: string;
  text: string;
  severity: "hot" | "high" | "info";
  source: DataSource;
};

export type DataSource = "google_business" | "website" | "pagespeed" | "derived" | "ai" | "osm";

export type ScoreBreakdown = {
  score: number;
  components: { key: string; label: string; weight: number; score: number | null; note?: string }[];
  note?: string;
};

export type ScoresPayload = {
  website: ScoreBreakdown;
  opportunity: ScoreBreakdown;
  design: ScoreBreakdown;
  mobile: ScoreBreakdown;
  technical: ScoreBreakdown;
  seo: ScoreBreakdown;
  ux: ScoreBreakdown;
  conversion: ScoreBreakdown;
  performance: ScoreBreakdown;
};

export type SortKey = "opportunity_desc" | "website_asc" | "rating_desc" | "reviews_desc" | "seo_asc" | "newest" | "name_asc" | "follow_up_asc";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "opportunity_desc", label: "Highest opportunity" },
  { key: "website_asc", label: "Worst website" },
  { key: "rating_desc", label: "Best Google rating" },
  { key: "reviews_desc", label: "Most reviews" },
  { key: "seo_asc", label: "Worst SEO" },
  { key: "newest", label: "Newest prospects" },
  { key: "name_asc", label: "Name A–Z" },
];
