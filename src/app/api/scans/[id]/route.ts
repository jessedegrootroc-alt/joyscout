import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { prospectRowSelect, serializeRow } from "@/server/prospects/query";
import { enqueueScan } from "@/server/jobs/queue";

export async function GET(req: Request, ctx: RouteContext<"/api/scans/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return Response.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const includeRows = url.searchParams.get("rows") !== "0";
  let rows: ReturnType<typeof serializeRow>[] = [];
  if (includeRows) {
    const prospects = await prisma.prospect.findMany({
      where: { userId: user.id, scans: { some: { scanId: id } } },
      orderBy: [{ opportunityScore: { sort: "desc", nulls: "last" } }, { name: "asc" }],
      select: prospectRowSelect,
      take: 500,
    });
    rows = prospects.map(serializeRow);
  }
  return Response.json({ scan, rows });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/scans/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return Response.json({ error: "Not found" }, { status: 404 });
  await prisma.scan.delete({ where: { id } });
  return Response.json({ ok: true });
}

/** Cancel a running scan (remaining analyze jobs skip) or retry a failed/cancelled one. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/scans/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) return Response.json({ error: "Not found" }, { status: 404 });
  if (body.action === "cancel" && (scan.status === "RUNNING" || scan.status === "QUEUED")) {
    await prisma.scan.update({ where: { id }, data: { status: "CANCELLED", stage: "Cancelled", completedAt: new Date() } });
    await prisma.scanProspect.updateMany({ where: { scanId: id, status: { in: ["PENDING", "ANALYZING"] } }, data: { status: "SKIPPED", stage: "Cancelled" } });
    return Response.json({ ok: true });
  }
  if (body.action === "retry" && (scan.status === "FAILED" || scan.status === "CANCELLED")) {
    // Reset the scan and run the same pipeline again. Prospects already stored stay in the
    // database; discovery links them again and counts them as "already known".
    await prisma.$transaction([
      prisma.scanProspect.deleteMany({ where: { scanId: id } }),
      prisma.scan.update({
        where: { id },
        data: { status: "QUEUED", stage: "Queued", error: null, providerNote: null, completedAt: null, startedAt: null, totalFound: 0, totalNew: 0, totalDuplicates: 0, analyzedCount: 0, failedCount: 0, noWebsiteCount: 0 },
      }),
    ]);
    try {
      await enqueueScan(id);
    } catch (err) {
      await prisma.scan.update({ where: { id }, data: { status: "FAILED", error: `Could not queue job: ${(err as Error).message}` } });
      return Response.json({ error: "Could not queue the scan. Is the database reachable?" }, { status: 500 });
    }
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Unsupported action" }, { status: 400 });
}
