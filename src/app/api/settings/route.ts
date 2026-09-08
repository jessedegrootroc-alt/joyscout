import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  companyName: z.string().max(120).nullable().optional(),
  senderName: z.string().max(120).nullable().optional(),
  senderRole: z.string().max(120).nullable().optional(),
  services: z.array(z.string().max(60)).max(12).optional(),
  outreachLanguage: z.enum(["en", "nl", "de", "fr"]).optional(),
  defaultCountry: z.string().length(2).optional(),
  signature: z.string().max(600).nullable().optional(),
  aiMinOpportunity: z.number().int().min(0).max(100).optional(),
});

export async function PUT(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const settings = await prisma.userSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, ...parsed.data }, update: parsed.data });
  return Response.json(settings);
}
