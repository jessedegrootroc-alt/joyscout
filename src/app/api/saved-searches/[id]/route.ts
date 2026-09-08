import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { scanInputSchema } from "@/lib/types";
import { enqueueScan } from "@/server/jobs/queue";

/** POST = run the saved search again (creates a scan). */
export async function POST(req: Request, ctx: RouteContext<"/api/saved-searches/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const saved = await prisma.savedSearch.findFirst({ where: { id, userId: user.id } });
  if (!saved) return Response.json({ error: "Not found" }, { status: 404 });
  const parsed = scanInputSchema.safeParse(saved.params);
  if (!parsed.success) return Response.json({ error: "Saved search has invalid parameters" }, { status: 400 });
  const input = parsed.data;
  const scan = await prisma.scan.create({
    data: { userId: user.id, name: `${saved.name} · ${new Date().toISOString().slice(0, 10)}`, query: input.query, industryKey: input.industryKey ?? null, location: input.location, countryCode: input.countryCode, radiusKm: input.radiusKm, maxResults: input.maxResults, filters: input.filters, savedSearchId: saved.id },
  });
  await prisma.savedSearch.update({ where: { id }, data: { lastRunAt: new Date(), runCount: { increment: 1 } } });
  try {
    await enqueueScan(scan.id);
  } catch (err) {
    await prisma.scan.update({ where: { id: scan.id }, data: { status: "FAILED", error: (err as Error).message } });
    return Response.json({ error: "Could not queue scan" }, { status: 500 });
  }
  return Response.json({ id: scan.id }, { status: 201 });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/saved-searches/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const res = await prisma.savedSearch.deleteMany({ where: { id, userId: user.id } });
  return Response.json({ ok: res.count > 0 });
}
