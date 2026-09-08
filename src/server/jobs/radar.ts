import { prisma } from "@/lib/prisma";
import type { ScanFilters } from "@/lib/types";
import { enqueueScan } from "./queue";
import { logActivity } from "@/server/prospects/activity";

export const RADAR_CRON: Record<string, string> = {
  DAILY: "0 6 * * *",
  WEEKLY: "0 6 * * 1",
  BIWEEKLY: "0 6 1,15 * *",
  MONTHLY: "0 6 1 * *",
};

export function nextRunFor(frequency: string, from = new Date()) {
  const d = new Date(from);
  d.setHours(6, 0, 0, 0);
  switch (frequency) {
    case "DAILY":
      d.setDate(d.getDate() + 1);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
      break;
    case "BIWEEKLY":
      d.setDate(d.getDate() + 14);
      break;
    default:
      d.setMonth(d.getMonth() + 1, 1);
  }
  return d;
}

/** Creates a scan for the radar; results are filtered into the radar list when analysed (see admitRadarResults). */
export async function runRadar(radarId: string) {
  const radar = await prisma.radar.findUnique({ where: { id: radarId } });
  if (!radar || !radar.isActive) return;
  const scan = await prisma.scan.create({
    data: {
      userId: radar.userId,
      name: `Radar · ${radar.name} · ${new Date().toISOString().slice(0, 10)}`,
      query: radar.query,
      industryKey: radar.industryKey,
      location: radar.location,
      countryCode: radar.countryCode,
      lat: radar.lat,
      lng: radar.lng,
      radiusKm: radar.radiusKm,
      maxResults: radar.maxResults,
      filters: radar.filters ?? {},
      radarId: radar.id,
    },
  });
  await prisma.radar.update({ where: { id: radarId }, data: { lastRunAt: new Date(), nextRunAt: nextRunFor(radar.frequency), runCount: { increment: 1 } } });
  await enqueueScan(scan.id);
}

/**
 * Called when a radar scan completes: adds NEW prospects that satisfy the
 * radar filters to the radar's list (duplicates are skipped by the join PK).
 */
export async function admitRadarResults(scanId: string) {
  const scan = await prisma.scan.findUnique({ where: { id: scanId }, include: { radar: true } });
  if (!scan?.radar) return;
  const f = (scan.radar.filters ?? {}) as ScanFilters;
  const items = await prisma.scanProspect.findMany({ where: { scanId, isNew: true }, include: { prospect: true } });
  let admitted = 0;
  for (const it of items) {
    const p = it.prospect;
    if (f.minOpportunityScore != null && (p.opportunityScore ?? 0) < f.minOpportunityScore) continue;
    if (f.maxWebsiteScore != null && p.hasWebsite && p.websiteScore != null && p.websiteScore > f.maxWebsiteScore) continue;
    const res = await prisma.listProspect.createMany({ data: [{ listId: scan.radar.listId, prospectId: p.id }], skipDuplicates: true });
    if (res.count) {
      admitted++;
      await logActivity(p.id, scan.userId, "LIST_ADDED", `Added by Radar “${scan.radar.name}”`, { radarId: scan.radar.id });
    }
  }
  await prisma.radar.update({ where: { id: scan.radar.id }, data: { newProspectsTotal: { increment: admitted } } });
}
