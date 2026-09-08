import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { scanFiltersSchema } from "@/lib/types";
import { enqueueRadarNow, scheduleRadar, unscheduleRadar } from "@/server/jobs/queue";
import { RADAR_CRON, nextRunFor } from "@/server/jobs/radar";

const patchSchema = z.object({
  action: z.enum(["pause", "resume", "run_now"]).optional(),
  name: z.string().trim().min(2).max(80).optional(),
  frequency: z.enum(["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]).optional(),
  maxResults: z.number().int().min(10).max(200).optional(),
  filters: scanFiltersSchema.optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/radars/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const radar = await prisma.radar.findFirst({ where: { id, userId: user.id } });
  if (!radar) return Response.json({ error: "Not found" }, { status: 404 });
  const d = parsed.data;
  try {
    if (d.action === "run_now") {
      await enqueueRadarNow(id);
      return Response.json({ ok: true, message: "Radar scan queued" });
    }
    if (d.action === "pause") {
      await unscheduleRadar(id);
      await prisma.radar.update({ where: { id }, data: { isActive: false, nextRunAt: null } });
      return Response.json({ ok: true });
    }
    if (d.action === "resume") {
      await scheduleRadar(id, RADAR_CRON[radar.frequency]);
      await prisma.radar.update({ where: { id }, data: { isActive: true, nextRunAt: nextRunFor(radar.frequency) } });
      return Response.json({ ok: true });
    }
    const updated = await prisma.radar.update({ where: { id }, data: { name: d.name, frequency: d.frequency, maxResults: d.maxResults, filters: d.filters, ...(d.frequency ? { nextRunAt: nextRunFor(d.frequency) } : {}) } });
    if (d.frequency && radar.isActive) await scheduleRadar(id, RADAR_CRON[d.frequency]);
    return Response.json(updated);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/radars/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const radar = await prisma.radar.findFirst({ where: { id, userId: user.id } });
  if (!radar) return Response.json({ error: "Not found" }, { status: 404 });
  await unscheduleRadar(id).catch(() => {});
  await prisma.radar.delete({ where: { id } });
  return Response.json({ ok: true });
}
