/**
 * Recompute all scores from the stored raw audit data without re-crawling.
 * Use after changing weights in src/server/scoring/weights.ts or the engine.
 *   npx tsx --tsconfig tsconfig.json scripts/rescore.mts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { scoreProspect, type BusinessSignals } from "@/server/scoring/engine";
import type { RawAudit } from "@/server/analysis/types";
import { platformFromTech } from "@/server/analysis/tech-detect";

const prospects = await prisma.prospect.findMany({ include: { analysis: { select: { rawAudit: true, aiDesignImpression: true, aiRecommendedService: true } } } });
let done = 0;
let skipped = 0;
for (const p of prospects) {
  const business: BusinessSignals = { name: p.name, hasWebsite: p.hasWebsite, rating: p.googleRating, reviewCount: p.googleReviewCount, businessStatus: p.businessStatus, hasPhone: Boolean(p.phone), hasEmail: Boolean(p.email), industryKey: p.industryKey, industry: p.industry, source: p.source, city: p.city };
  let audit: RawAudit | null = null;
  if (p.hasWebsite) {
    audit = (p.analysis?.rawAudit as RawAudit | null) ?? null;
    if (!audit) {
      skipped++;
      continue;
    }
  }
  const out = scoreProspect({ audit, business, aiDesignImpression: p.analysis?.aiDesignImpression ?? null });
  await prisma.prospect.update({
    where: { id: p.id },
    data: {
      websiteScore: out.websiteScore,
      designScore: out.designScore,
      uxScore: out.uxScore,
      seoScore: out.seoScore,
      performanceScore: out.performanceScore,
      conversionScore: out.conversionScore,
      mobileScore: out.mobileScore,
      technicalScore: out.technicalScore,
      opportunityScore: out.opportunityScore,
      platform: audit ? platformFromTech(audit.tech) : p.platform,
      recommendedService: p.analysis?.aiRecommendedService && out.websiteScore != null && out.websiteScore >= 40 ? p.analysis.aiRecommendedService : out.recommendedService,
      priorityLabels: out.priorityLabels,
      insights: out.insights.map((i) => i.text),
      issueKeys: audit ? out.issueKeys : ["no_website"],
      ageVerdict: out.ageVerdict,
    },
  });
  if (audit) await prisma.websiteAnalysis.update({ where: { prospectId: p.id }, data: { checks: out.checks as never, issues: out.issues as never, scores: out.scores as never, insights: out.insights as never, ageVerdict: out.ageVerdict } });
  done++;
}
console.log(`rescored ${done} prospects, skipped ${skipped} without stored raw audit (re-analyse them to store one)`);
await prisma.$disconnect();
