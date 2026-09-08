import { prisma } from "@/lib/prisma";
import { INDUSTRY_MAP, COUNTRIES } from "@/lib/industries";
import type { ScanFilters } from "@/lib/types";
import { geocode } from "@/server/providers/geocode";
import { selectProviders } from "@/server/providers";
import { normalizeAddress, normalizeName, normalizePhone, normalizeWebsite } from "@/server/providers/normalize";
import type { RawBusiness } from "@/server/providers/types";
import { scoreProspect } from "@/server/scoring/engine";
import { enqueueAnalyze } from "./queue";
import { logActivity } from "@/server/prospects/activity";

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
    const industry = scan.industryKey ? INDUSTRY_MAP.get(scan.industryKey) ?? null : null;
    const language = COUNTRIES.find((c) => c.code === scan.countryCode)?.lang === "nl" ? "nl" : "en";
    const providers = selectProviders();
    const raw: RawBusiness[] = [];
    const used: string[] = [];
    for (const provider of providers) {
      try {
        const found = await provider.search(
          { query: scan.query, industry, center: { lat, lng }, radiusKm: scan.radiusKm, countryCode: scan.countryCode, language, maxResults: scan.maxResults, locationLabel },
          (msg) => prisma.scan.update({ where: { id: scanId }, data: { stage: `${STAGES.search} · ${msg}` } }).catch(() => {}),
        );
        raw.push(...found);
        used.push(provider.key);
      } catch (err) {
        console.error(`[discover] provider ${provider.key} failed`, err);
        if (providers.length === 1) throw err;
      }
    }
    await prisma.scan.update({ where: { id: scanId }, data: { providers: used, stage: STAGES.websites } });

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
            emailSource: b.email ? (b.source === "overpass" ? "osm" : "directory") : null,
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
        await logActivity(prospectId, scan.userId, "DISCOVERED", `Prospect discovered via ${b.source === "google_places" ? "Google Places" : "OpenStreetMap"} (scan “${scan.name}”)`, { scanId });
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
    business: { name: p.name, hasWebsite: false, rating: p.googleRating, reviewCount: p.googleReviewCount, businessStatus: p.businessStatus, hasPhone: Boolean(p.phone), hasEmail: Boolean(p.email), industryKey: p.industryKey, industry: p.industry, source: p.source, city: p.city },
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
