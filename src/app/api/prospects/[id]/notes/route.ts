import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/server/prospects/activity";

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[id]/notes">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const parsed = z.object({ body: z.string().trim().min(1).max(5000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const prospect = await prisma.prospect.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!prospect) return Response.json({ error: "Not found" }, { status: 404 });
  const note = await prisma.note.create({ data: { prospectId: id, userId: user.id, body: parsed.data.body } });
  await logActivity(id, user.id, "NOTE_ADDED", parsed.data.body.length > 120 ? `${parsed.data.body.slice(0, 117)}…` : parsed.data.body, { noteId: note.id });
  return Response.json(note, { status: 201 });
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/prospects/[id]/notes">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const noteId = new URL(req.url).searchParams.get("noteId");
  if (!noteId) return Response.json({ error: "noteId required" }, { status: 400 });
  const res = await prisma.note.deleteMany({ where: { id: noteId, prospectId: id, userId: user.id } });
  return Response.json({ ok: res.count > 0 });
}
