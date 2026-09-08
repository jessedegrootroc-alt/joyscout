import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, ctx: RouteContext<"/api/lists/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const parsed = z.object({ name: z.string().trim().min(1).max(80).optional(), description: z.string().max(300).nullable().optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const list = await prisma.list.findFirst({ where: { id, userId: user.id } });
  if (!list) return Response.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.list.update({ where: { id }, data: parsed.data });
  return Response.json(updated);
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/lists/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const list = await prisma.list.findFirst({ where: { id, userId: user.id }, include: { radars: { select: { id: true } } } });
  if (!list) return Response.json({ error: "Not found" }, { status: 404 });
  if (list.radars.length) return Response.json({ error: "This list is used by a Radar. Delete the radar first." }, { status: 409 });
  await prisma.list.delete({ where: { id } });
  return Response.json({ ok: true });
}
