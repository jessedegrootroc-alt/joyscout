import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request, ctx: RouteContext<"/api/outreach/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const res = await prisma.outreachMessage.deleteMany({ where: { id, userId: user.id } });
  return Response.json({ ok: res.count > 0 });
}
