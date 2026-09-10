import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES, type SortKey } from "@/lib/types";
export type { SortKey } from "@/lib/types";
export { SORT_OPTIONS } from "@/lib/types";

export type ProspectFilters = {
  q?: string;
  scanId?: string;
  listId?: string;
  websiteScore?: string; // "0-30" | "30-50" | "50-70" | "70-100"
  opportunityScore?: string; // "0-40" | "40-65" | "65-80" | "80-100"
  seoScore?: string;
  minRating?: number;
  minReviews?: number;
  hasWebsite?: "yes" | "no";
  hasEmail?: "yes" | "no";
  hasPhone?: "yes" | "no";
  platform?: string[];
  issues?: string[];
  status?: string[];
  labels?: string[];
  city?: string;
  industry?: string;
  followUpDue?: boolean;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
};

function parseRange(v?: string): { gte?: number; lte?: number } | undefined {
  if (!v) return undefined;
  const [a, b] = v.split("-").map(Number);
  if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
  return { gte: a, lte: b };
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): ProspectFilters {
  const str = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) || undefined;
  const arr = (k: string) => {
    const v = sp[k];
    if (!v) return undefined;
    const list = (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean);
    return list.length ? list : undefined;
  };
  const num = (k: string) => {
    const v = str(k);
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    q: str("q"),
    scanId: str("scanId"),
    listId: str("listId"),
    websiteScore: str("websiteScore"),
    opportunityScore: str("opportunityScore"),
    seoScore: str("seoScore"),
    minRating: num("minRating"),
    minReviews: num("minReviews"),
    hasWebsite: str("hasWebsite") as ProspectFilters["hasWebsite"],
    hasEmail: str("hasEmail") as ProspectFilters["hasEmail"],
    hasPhone: str("hasPhone") as ProspectFilters["hasPhone"],
    platform: arr("platform"),
    issues: arr("issues"),
    status: arr("status")?.filter((s) => (LEAD_STATUSES as readonly string[]).includes(s)),
    labels: arr("labels"),
    city: str("city"),
    industry: str("industry"),
    followUpDue: str("followUpDue") === "1",
    sort: (str("sort") as SortKey) || "opportunity_desc",
    page: Math.max(1, num("page") ?? 1),
    pageSize: Math.min(200, Math.max(10, num("pageSize") ?? 50)),
  };
}

export function buildWhere(userId: string, f: ProspectFilters): Prisma.ProspectWhereInput {
  const and: Prisma.ProspectWhereInput[] = [{ userId }];
  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { domain: { contains: f.q, mode: "insensitive" } },
        { email: { contains: f.q, mode: "insensitive" } },
        { city: { contains: f.q, mode: "insensitive" } },
        { industry: { contains: f.q, mode: "insensitive" } },
      ],
    });
  }
  if (f.scanId) and.push({ scans: { some: { scanId: f.scanId } } });
  if (f.listId) and.push({ lists: { some: { listId: f.listId } } });
  const ws = parseRange(f.websiteScore);
  if (ws) and.push({ websiteScore: ws });
  const os = parseRange(f.opportunityScore);
  if (os) and.push({ opportunityScore: os });
  const ss = parseRange(f.seoScore);
  if (ss) and.push({ seoScore: ss });
  if (f.minRating != null) and.push({ googleRating: { gte: f.minRating } });
  if (f.minReviews != null) and.push({ googleReviewCount: { gte: f.minReviews } });
  if (f.hasWebsite === "yes") and.push({ hasWebsite: true });
  if (f.hasWebsite === "no") and.push({ hasWebsite: false });
  if (f.hasEmail === "yes") and.push({ email: { not: null } });
  if (f.hasEmail === "no") and.push({ email: null });
  if (f.hasPhone === "yes") and.push({ phone: { not: null } });
  if (f.hasPhone === "no") and.push({ phone: null });
  if (f.platform?.length) {
    const wantsUnknown = f.platform.includes("Unknown");
    const named = f.platform.filter((p) => p !== "Unknown");
    const or: Prisma.ProspectWhereInput[] = [];
    if (named.length) or.push({ platform: { in: named } });
    if (wantsUnknown) or.push({ platform: null }, { platform: "Unknown" });
    and.push({ OR: or });
  }
  if (f.issues?.length) and.push({ issueKeys: { hasSome: f.issues } });
  if (f.status?.length) and.push({ status: { in: f.status as never[] } });
  if (f.labels?.length) and.push({ priorityLabels: { hasSome: f.labels } });
  if (f.city) and.push({ city: { equals: f.city, mode: "insensitive" } });
  if (f.industry) and.push({ OR: [{ industryKey: f.industry }, { industry: { equals: f.industry, mode: "insensitive" } }] });
  if (f.followUpDue) and.push({ followUpAt: { lte: new Date() }, status: { notIn: ["WON", "LOST", "NOT_INTERESTED"] } });
  return { AND: and };
}

export function buildOrderBy(sort: SortKey | undefined): Prisma.ProspectOrderByWithRelationInput[] {
  switch (sort) {
    case "website_asc":
      return [{ hasWebsite: "asc" }, { websiteScore: { sort: "asc", nulls: "last" } }, { opportunityScore: { sort: "desc", nulls: "last" } }];
    case "rating_desc":
      return [{ googleRating: { sort: "desc", nulls: "last" } }, { googleReviewCount: { sort: "desc", nulls: "last" } }];
    case "reviews_desc":
      return [{ googleReviewCount: { sort: "desc", nulls: "last" } }];
    case "seo_asc":
      return [{ seoScore: { sort: "asc", nulls: "last" } }];
    case "newest":
      return [{ dateFound: "desc" }];
    case "name_asc":
      return [{ name: "asc" }];
    case "follow_up_asc":
      return [{ followUpAt: { sort: "asc", nulls: "last" } }];
    case "opportunity_desc":
    default:
      return [{ opportunityScore: { sort: "desc", nulls: "last" } }, { dateFound: "desc" }];
  }
}

export const prospectRowSelect = {
  id: true,
  name: true,
  industry: true,
  industryKey: true,
  website: true,
  domain: true,
  hasWebsite: true,
  phone: true,
  email: true,
  city: true,
  countryCode: true,
  googleRating: true,
  googleReviewCount: true,
  googleMapsUrl: true,
  websiteScore: true,
  seoScore: true,
  uxScore: true,
  performanceScore: true,
  conversionScore: true,
  mobileScore: true,
  designScore: true,
  opportunityScore: true,
  platform: true,
  recommendedService: true,
  priorityLabels: true,
  insights: true,
  issueKeys: true,
  status: true,
  analysisStatus: true,
  analysisError: true,
  followUpAt: true,
  contactedAt: true,
  dateFound: true,
  source: true,
  socialLinks: true,
  analysis: { select: { screenshotDesktop: true, fetchOutcome: true } },
} satisfies Prisma.ProspectSelect;

export type ProspectRow = Prisma.ProspectGetPayload<{ select: typeof prospectRowSelect }>;

export async function queryProspects(userId: string, f: ProspectFilters) {
  const where = buildWhere(userId, f);
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 50;
  const [rows, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy: buildOrderBy(f.sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: prospectRowSelect,
    }),
    prisma.prospect.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

/** Serialisable row for client components */
export function serializeRow(r: ProspectRow) {
  return {
    ...r,
    followUpAt: r.followUpAt?.toISOString() ?? null,
    contactedAt: r.contactedAt?.toISOString() ?? null,
    dateFound: r.dateFound.toISOString(),
    screenshot: r.analysis?.screenshotDesktop ? `/api/screenshots/${r.id}/desktop` : null,
    // "Social only": no website, but a Facebook/Instagram/LinkedIn page was found.
    socialOnly: !r.hasWebsite ? socialOnlyOf(r.socialLinks) : null,
    socialLinks: undefined,
    analysis: undefined,
  };
}
export type ProspectRowDTO = ReturnType<typeof serializeRow>;

function socialOnlyOf(links: unknown): { network: "facebook" | "instagram" | "linkedin"; url: string } | null {
  const l = (links ?? {}) as Record<string, string>;
  for (const network of ["facebook", "instagram", "linkedin"] as const) if (l[network]) return { network, url: l[network] };
  return null;
}
