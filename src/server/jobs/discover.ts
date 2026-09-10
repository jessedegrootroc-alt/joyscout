import { prisma } from "@/lib/prisma";
import { INDUSTRY_MAP, COUNTRIES } from "@/lib/industries";
import type { ScanFilters } from "@/lib/types";
import { geocode } from "@/server/providers/geocode";
import { planProviders } from "@/server/providers";
import { normalizeAddress, normalizeName, normalizePhone, normalizeWebsite } from "@/server/providers/normalize";
import type { RawBusiness } from "@/server/providers/types";
import { scoreProspect } from "@/server/scoring/engine";
import { enqueueAnalyze } from "./queue";
import { logActivity } from "@/server/prospects/activity";
import type { ImportItem } from "@/lib/import-parse";
import type { BusinessProvider } from "@/server/providers/types";

const STAGES = {
  search: "Searching businesses",
  websites: "Finding websites",
  analyze: "Analyzing websites",
};

export async function runScanDiscovery(scanId: string) {
  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan) return;
  if (scan.status === "CANCELLED") return;
  const filters = (scan.filters ?? {}) as ScanFilters;
  await prisma.scan.update({ where: { id: scanId }, data: { status: "RUNNING", stage: STAGES.search, startedAt: scan.startedAt ?? new Date(), error: null } });

  try {
    const industry = scan.industryKey ? INDUSTRY_MAP.get(scan.industryKey) ?? null : null;
    const language = COUNTRIES.find((c) => c.code === scan.countryCode)?.lang === "nl" ? "nl" : "en";
    const plan = await planProviders();
    const raw: RawBusiness[] = [];
    const used: string[] = [];
    let providerNote = plan.note;
    const progress = (msg: string) => prisma.scan.update({ where: { id: scanId }, data: { stage: `${STAGES.search} · ${msg}` } }).catch(() => {});

    if (scan.kind === "import") {
      // ── Import: resolve each pasted line to a business ──────────────────────
      const items = (scan.importItems ?? []) as ImportItem[];
      const r = await resolveImportItems(items, { provider: plan.providers[0], countryCode: scan.countryCode, defaultCity: scan.location === "Various" ? null : scan.location, language, requestBudget: plan.requestBudget, progress });
      raw.push(...r.businesses);
      used.push(...r.providersUsed);
      if (r.budgetHit) providerNote = "Google Places monthly budget reached during the import; remaining names were added without lookup.";
      if (r.unresolved) providerNote = [providerNote, `${r.unresolved} of ${items.length} names could not be matched to a listing and were added as-is (no website, no reviews).`].filter(Boolean).join(" ");
    } else {
      // 1. Geocode
      let lat = scan.lat;
      let lng = scan.lng;
      let locationLabel = scan.location;
      if (lat == null || lng == null) {
        const geo = await geocode(scan.location, scan.countryCode);
        if (!geo) throw new Error(`Could not geocode "${scan.location}" (${scan.countryCode}). Try a city name or postal code.`);
        lat = geo.lat;
        lng = geo.lng;
        locationLabel = geo.city ? `${geo.city}${geo.region ? `, ${geo.region}` : ""}` : scan.location;
        await prisma.scan.update({ where: { id: scanId }, data: { lat, lng } });
      }

      // 2. Discover via providers
      for (const provider of plan.providers) {
        try {
          const result = await provider.search(
            { query: scan.query, industry, center: { lat, lng }, radiusKm: scan.radiusKm, countryCode: scan.countryCode, language, maxResults: scan.maxResults, locationLabel, requestBudget: plan.requestBudget },
            progress,
          );
          raw.push(...result.businesses);
          used.push(provider.key);
          if (result.budgetHit) providerNote = `Google Places monthly budget reached after ${result.requestsUsed} request(s); results may be incomplete. Raise the budget in Settings or wait for the monthly reset.`;
        } catch (err) {
          console.error(`[discover] provider ${provider.key} failed`, err);
          if (plan.providers.length === 1) throw err;
        }
      }
    }
    await prisma.scan.update({ where: { id: scanId }, data: { providers: [...new Set(used)], providerNote, stage: STAGES.websites } });

    // 3. Normalise + apply discovery filters
    const candidates = raw
      .map((b) => normalizeBusiness(b, scan.countryCode))
      .filter((b) => {
        if (filters.minReviews != null && b.source === "google_places" && (b.reviewCount ?? 0) < filters.minReviews) return false;
        if (filters.minRating != null && b.rating != null && b.rating < filters.minRating) return false;
        if (filters.websiteRequired === "yes" && !b.website) return false;
        if (filters.websiteRequired === "no" && b.website) return false;
        return true;
      });

    // 4. Dedupe against the user's existing prospects + within this batch
    const existing = await prisma.prospect.findMany({
      where: { userId: scan.userId },
      select: { id: true, googlePlaceId: true, domain: true, phoneNormalized: true, name: true, address: true, postalCode: true, hasWebsite: true, lastAnalyzedAt: true, analysisStatus: true },
    });
    const byPlace = new Map(existing.filter((e) => e.googlePlaceId).map((e) => [e.googlePlaceId!, e]));
    const byDomain = new Map(existing.filter((e) => e.domain).map((e) => [e.domain!, e]));
    const byPhone = new Map(existing.filter((e) => e.phoneNormalized).map((e) => [e.phoneNormalized!, e]));
    const byNameAddr = new Map(existing.map((e) => [`${normalizeName(e.name)}|${normalizeAddress(e.address) ?? e.postalCode ?? ""}`, e]));
    const batchKeys = new Set<string>();

    let totalNew = 0;
    let totalDup = 0;
    let noWebsite = 0;
    const toAnalyze: string[] = [];

    for (const b of candidates) {
      if ((await prisma.scan.findUnique({ where: { id: scanId }, select: { status: true } }))?.status === "CANCELLED") break;
      const keys = [b.googlePlaceId ? `p:${b.googlePlaceId}` : null, b.domain ? `d:${b.domain}` : null, b.phoneNormalized ? `t:${b.phoneNormalized}` : null, `n:${normalizeName(b.name)}|${normalizeAddress(b.address) ?? b.postalCode ?? ""}`].filter(Boolean) as string[];
      if (keys.some((k) => batchKeys.has(k))) {
        totalDup++;
        continue;
      }
      keys.forEach((k) => batchKeys.add(k));

      const match =
        (b.googlePlaceId && byPlace.get(b.googlePlaceId)) ||
        (b.domain && byDomain.get(b.domain)) ||
        (b.phoneNormalized && byPhone.get(b.phoneNormalized)) ||
        byNameAddr.get(`${normalizeName(b.name)}|${normalizeAddress(b.address) ?? b.postalCode ?? ""}`) ||
        null;

      let prospectId: string;
      let isNew = false;
      if (match) {
        totalDup++;
        prospectId = match.id;
        // Refresh volatile business data (rating, reviews, phone) but keep CRM fields.
        await prisma.prospect.update({
          where: { id: match.id },
          data: {
            googleRating: b.rating ?? undefined,
            googleReviewCount: b.reviewCount ?? undefined,
            businessStatus: b.businessStatus ?? undefined,
            phone: b.phone ?? undefined,
            phoneNormalized: b.phoneNormalized ?? undefined,
            googlePlaceId: match.googlePlaceId ?? b.googlePlaceId ?? undefined,
            googleMapsUrl: b.googleMapsUrl ?? undefined,
            website: match.hasWebsite ? undefined : b.website ?? undefined,
            domain: match.hasWebsite ? undefined : b.domain ?? undefined,
            hasWebsite: match.hasWebsite || Boolean(b.website),
          },
        });
      } else {
        isNew = true;
        totalNew++;
        const created = await prisma.prospect.create({
          data: {
            userId: scan.userId,
            name: b.name,
            industry: industry ? industry.label.en : scan.query,
            industryKey: scan.industryKey,
            website: b.website,
            domain: b.domain,
            hasWebsite: Boolean(b.website),
            phone: b.phone,
            phoneNormalized: b.phoneNormalized,
            email: b.email,
            emailSource: b.email ? (b.source === "overpass" ? "osm" : b.source === "manual" ? "manual" : "directory") : null,
            address: b.address,
            street: b.street,
            postalCode: b.postalCode,
            city: b.city,
            region: b.region,
            countryCode: b.countryCode,
            lat: b.lat,
            lng: b.lng,
            googlePlaceId: b.googlePlaceId,
            googleMapsUrl: b.googleMapsUrl,
            googleRating: b.rating,
            googleReviewCount: b.reviewCount,
            businessStatus: b.businessStatus,
            googleTypes: b.types ?? [],
            socialLinks: b.socialLinks ?? undefined,
            source: b.source,
            sourceRef: b.sourceRef,
            analysisStatus: b.website ? "PENDING" : "NO_WEBSITE",
          },
        });
        prospectId = created.id;
        if (b.googlePlaceId) byPlace.set(b.googlePlaceId, { ...created, analysisStatus: created.analysisStatus });
        if (b.domain) byDomain.set(b.domain, { ...created });
        if (b.phoneNormalized) byPhone.set(b.phoneNormalized, { ...created });
        await logActivity(prospectId, scan.userId, "DISCOVERED", `Prospect ${b.source === "manual" ? "imported from a pasted list" : `discovered via ${b.source === "google_places" ? "Google Places" : "OpenStreetMap"}`} (${scan.kind === "import" ? "import" : "scan"} “${scan.name}”)`, { scanId });
      }

      const hasSite = Boolean(b.website) || (match?.hasWebsite ?? false);
      await prisma.scanProspect.upsert({
        where: { scanId_prospectId: { scanId, prospectId } },
        create: { scanId, prospectId, isNew, status: hasSite ? "PENDING" : "NO_WEBSITE", stage: hasSite ? "Queued for analysis" : "No website" },
        update: {},
      });

      if (!hasSite) {
        noWebsite++;
        await scoreNoWebsiteProspect(prospectId);
      } else {
        toAnalyze.push(prospectId);
      }
    }

    await prisma.scan.update({
      where: { id: scanId },
      data: { totalFound: totalNew + totalDup, totalNew, totalDuplicates: totalDup, noWebsiteCount: noWebsite, stage: toAnalyze.length ? STAGES.analyze : "Calculating scores" },
    });

    if (toAnalyze.length === 0) {
      await finalizeScanIfDone(scanId);
      return;
    }
    // Higher-rated businesses first so the best leads appear early.
    for (const [i, prospectId] of toAnalyze.entries()) await enqueueAnalyze({ prospectId, scanId }, Math.max(0, toAnalyze.length - i));
  } catch (err) {
    console.error("[discover] scan failed", err);
    await prisma.scan.update({ where: { id: scanId }, data: { status: "FAILED", stage: "Failed", error: (err as Error).message.slice(0, 500), completedAt: new Date() } });
    throw err;
  }
}

function normalizeBusiness(b: RawBusiness, fallbackCountry: string) {
  const site = normalizeWebsite(b.website);
  const social = { ...(b.socialLinks ?? {}) };
  if (b.website && !site) {
    // Website field pointed at a social profile – keep it as a social link.
    const host = safeHost(b.website);
    if (host?.includes("facebook")) social.facebook = b.website;
    if (host?.includes("instagram")) social.instagram = b.website;
  }
  const countryCode = (b.countryCode ?? fallbackCountry).toUpperCase();
  return {
    ...b,
    name: b.name.replace(/\s+/g, " ").trim(),
    website: site?.url ?? null,
    domain: site?.domain ?? null,
    phone: b.phone ?? b.internationalPhone ?? null,
    phoneNormalized: normalizePhone(b.internationalPhone ?? b.phone, countryCode),
    email: b.email?.toLowerCase() ?? null,
    countryCode,
    socialLinks: Object.keys(social).length ? social : undefined,
  };
}

function safeHost(u: string) {
  try {
    return new URL(u.startsWith("http") ? u : `https://${u}`).hostname;
  } catch {
    return null;
  }
}

/** Businesses without a website are scored immediately (very high opportunity). */
export async function scoreNoWebsiteProspect(prospectId: string) {
  const p = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!p) return;
  const out = scoreProspect({
    audit: null,
    business: { name: p.name, hasWebsite: false, rating: p.googleRating, reviewCount: p.googleReviewCount, businessStatus: p.businessStatus, hasPhone: Boolean(p.phone), hasEmail: Boolean(p.email), industryKey: p.industryKey, industry: p.industry, source: p.source, city: p.city, socialLinks: (p.socialLinks as Record<string, string> | null) ?? null },
  });
  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      opportunityScore: out.opportunityScore,
      priorityLabels: out.priorityLabels,
      insights: out.insights.map((i) => i.text),
      issueKeys: ["no_website"],
      recommendedService: out.recommendedService,
      analysisStatus: "NO_WEBSITE",
      lastAnalyzedAt: new Date(),
    },
  });
}

/** Marks the scan COMPLETED when every ScanProspect reached a terminal state. */
export async function finalizeScanIfDone(scanId: string) {
  const scan = await prisma.scan.findUnique({ where: { id: scanId } });
  if (!scan || scan.status === "CANCELLED" || scan.status === "FAILED") return;
  const groups = await prisma.scanProspect.groupBy({ by: ["status"], where: { scanId }, _count: { _all: true } });
  const count = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const pending = count("PENDING") + count("ANALYZING");
  const analyzed = count("COMPLETED");
  const failed = count("FAILED");
  const noWebsite = count("NO_WEBSITE");
  const skipped = count("SKIPPED");
  const total = groups.reduce((a, g) => a + g._count._all, 0);
  await prisma.scan.update({
    where: { id: scanId },
    data: {
      analyzedCount: analyzed,
      failedCount: failed,
      noWebsiteCount: noWebsite,
      totalFound: total,
      ...(pending === 0
        ? { status: "COMPLETED", stage: "Done", completedAt: new Date() }
        : { stage: analyzed + failed + skipped + noWebsite >= total * 0.85 ? "Calculating scores" : STAGES.analyze }),
    },
  });
}

/**
 * Resolves pasted names to real listings: one provider search per item (name as query,
 * around the item's city), keeping the best name match. Names without a match are kept
 * as manual prospects so nothing from the list is lost.
 */
async function resolveImportItems(
  items: ImportItem[],
  opts: { provider: BusinessProvider | undefined; countryCode: string; defaultCity: string | null; language: "nl" | "en"; requestBudget?: number; progress: (msg: string) => Promise<unknown> },
) {
  const businesses: RawBusiness[] = [];
  const providersUsed = new Set<string>();
  const geoCache = new Map<string, { lat: number; lng: number } | null>();
  let budgetLeft = opts.requestBudget ?? Number.POSITIVE_INFINITY;
  let budgetHit = false;
  let unresolved = 0;

  const countryName = COUNTRIES.find((c) => c.code === opts.countryCode)?.name ?? opts.countryCode;
  const geoFor = async (city: string | null) => {
    const key = (city ?? countryName).toLowerCase();
    if (!geoCache.has(key)) geoCache.set(key, await geocode(city ?? countryName, opts.countryCode).catch(() => null));
    return geoCache.get(key) ?? null;
  };

  for (const [idx, item] of items.entries()) {
    await opts.progress(`resolving ${idx + 1}/${items.length}: ${item.name}`);
    const city = item.city ?? opts.defaultCity;
    let match: RawBusiness | null = null;
    if (opts.provider && budgetLeft >= 1) {
      const center = await geoFor(city);
      if (center) {
        try {
          const res = await opts.provider.search(
            { query: item.name, industry: null, center, radiusKm: city ? 15 : 50, countryCode: opts.countryCode, language: opts.language, maxResults: 5, locationLabel: city ?? countryName, requestBudget: Math.min(budgetLeft, 1) },
            async () => {},
          );
          budgetLeft -= res.requestsUsed;
          if (res.budgetHit) budgetHit = true;
          providersUsed.add(opts.provider.key);
          match = pickBestMatch(item.name, res.businesses);
        } catch (err) {
          console.error(`[import] lookup failed for "${item.name}"`, (err as Error).message);
        }
      }
    }
    if (match) {
      if (item.facebook) match.socialLinks = { ...(match.socialLinks ?? {}), facebook: item.facebook };
      businesses.push(match);
    } else {
      unresolved++;
      businesses.push({ source: "manual", sourceRef: `import:${item.raw.slice(0, 120)}`, name: item.name, city, countryCode: opts.countryCode, socialLinks: item.facebook ? { facebook: item.facebook } : undefined });
    }
  }
  return { businesses, providersUsed: [...providersUsed], budgetHit, unresolved };
}

/** Token-overlap name matching; requires a clear match so we never attach the wrong listing. */
function pickBestMatch(name: string, candidates: RawBusiness[]): RawBusiness | null {
  const tokens = (s: string) => new Set(normalizeName(s).split(/\s+/).filter((t) => t.length > 1));
  const want = tokens(name);
  if (want.size === 0) return null;
  let best: { b: RawBusiness; score: number } | null = null;
  for (const b of candidates) {
    const have = tokens(b.name);
    const overlap = [...want].filter((t) => have.has(t)).length;
    const score = overlap / Math.max(want.size, 1);
    const contains = normalizeName(b.name).includes(normalizeName(name)) || normalizeName(name).includes(normalizeName(b.name));
    const s = Math.max(score, contains ? 0.8 : 0);
    if (!best || s > best.score) best = { b, score: s };
  }
  return best && best.score >= 0.6 ? best.b : null;
}
