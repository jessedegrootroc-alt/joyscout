import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { scanFiltersSchema } from "@/lib/types";
import { geocode } from "@/server/providers/geocode";
import { scheduleRadar, enqueueRadarNow } from "@/server/jobs/queue";
import { RADAR_CRON, nextRunFor } from "@/server/jobs/radar";
import { INDUSTRY_MAP } from "@/lib/industries";

export const radarSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  query: z.string().trim().min(2).max(80),
  industryKey: z.string().max(60).nullable().optional(),
  location: z.string().trim().min(2).max(120),
  countryCode: z.string().length(2).default("NL"),
  radiusKm: z.number().int().min(1).max(50).default(25),
  maxResults: z.number().int().min(10).max(200).default(60),
  filters: scanFiltersSchema.default({ websiteRequired: "any" }),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]).default("WEEKLY"),
  listId: z.string().optional(),
  runNow: z.boolean().optional(),
});

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const radars = await prisma.radar.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { list: { select: { id: true, name: true } } } });
  return Response.json(radars);
}

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const parsed = radarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const industry = d.industryKey ? INDUSTRY_MAP.get(d.industryKey) : undefined;
  const name = d.name || `${industry?.label.en ?? d.query} in ${d.location}`;
  const geo = await geocode(d.location, d.countryCode);
  if (!geo) return Response.json({ error: `Could not geocode “${d.location}”` }, { status: 400 });

  let listId = d.listId;
  if (listId) {
    const list = await prisma.list.findFirst({ where: { id: listId, userId: user.id } });
    if (!list) return Response.json({ error: "List not found" }, { status: 404 });
  } else {
    const base = `Radar · ${name}`;
    let listName = base;
    for (let i = 2; await prisma.list.findFirst({ where: { userId: user.id, name: listName } }); i++) listName = `${base} (${i})`;
    const list = await prisma.list.create({ data: { userId: user.id, name: listName, description: `Automatically filled by radar “${name}”`, isSystem: true } });
    listId = list.id;
  }

  const radar = await prisma.radar.create({
    data: { userId: user.id, name, query: d.query, industryKey: d.industryKey ?? null, location: d.location, countryCode: d.countryCode, lat: geo.lat, lng: geo.lng, radiusKm: d.radiusKm, maxResults: d.maxResults, filters: d.filters, frequency: d.frequency, listId, nextRunAt: nextRunFor(d.frequency) },
  });
  try {
    await scheduleRadar(radar.id, RADAR_CRON[d.frequency]);
    if (d.runNow) await enqueueRadarNow(radar.id);
  } catch (err) {
    return Response.json({ error: `Radar saved but scheduling failed: ${(err as Error).message}` }, { status: 500 });
  }
  return Response.json(radar, { status: 201 });
}
