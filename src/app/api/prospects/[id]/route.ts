import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES } from "@/lib/types";
import { logActivity } from "@/server/prospects/activity";

const patchSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  contactedAt: z.string().datetime().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/prospects/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const prospect = await prisma.prospect.findFirst({ where: { id, userId: user.id } });
  if (!prospect) return Response.json({ error: "Not found" }, { status: 404 });
  const d = parsed.data;
  const now = new Date();
  const data: Record<string, unknown> = { lastActivityAt: now };
  if (d.status && d.status !== prospect.status) {
    data.status = d.status;
    if (d.status === "CONTACTED" && !prospect.contactedAt) data.contactedAt = now;
    await logActivity(id, user.id, d.status === "CONTACTED" ? "CONTACTED" : "STATUS_CHANGED", d.status === "CONTACTED" ? "Marked as contacted" : `Status changed from ${prospect.status} to ${d.status}`, { from: prospect.status, to: d.status });
  }
  if (d.followUpAt !== undefined) {
    data.followUpAt = d.followUpAt ? new Date(d.followUpAt) : null;
    if (d.followUpAt) await logActivity(id, user.id, "FOLLOW_UP_SCHEDULED", `Follow-up scheduled for ${new Date(d.followUpAt).toDateString()}`);
  }
  if (d.contactedAt !== undefined) data.contactedAt = d.contactedAt ? new Date(d.contactedAt) : null;
  if (d.email !== undefined) {
    data.email = d.email;
    data.emailSource = d.email ? "manual" : null;
  }
  if (d.phone !== undefined) data.phone = d.phone;
  const updated = await prisma.prospect.update({ where: { id }, data });
  return Response.json({ ok: true, status: updated.status, followUpAt: updated.followUpAt, contactedAt: updated.contactedAt });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/prospects/[id]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const res = await prisma.prospect.deleteMany({ where: { id, userId: user.id } });
  if (!res.count) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
