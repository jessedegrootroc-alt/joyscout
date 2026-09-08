import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { prospectRowSelect, serializeRow } from "@/server/prospects/query";

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

/** Cancel a running scan. Remaining analyze jobs check the scan status and skip. */
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
  return Response.json({ error: "Unsupported action" }, { status: 400 });
}
