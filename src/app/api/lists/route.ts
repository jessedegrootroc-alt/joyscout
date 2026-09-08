import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const lists = await prisma.list.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, include: { _count: { select: { prospects: true } } } });
  return Response.json(lists);
}

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const parsed = z.object({ name: z.string().trim().min(1).max(80), description: z.string().max(300).optional(), color: z.string().max(20).optional() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const existing = await prisma.list.findFirst({ where: { userId: user.id, name: parsed.data.name } });
  if (existing) return Response.json({ error: "A list with this name already exists" }, { status: 409 });
  const list = await prisma.list.create({ data: { userId: user.id, ...parsed.data } });
  return Response.json(list, { status: 201 });
}
