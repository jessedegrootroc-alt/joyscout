import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { OUTREACH_CHANNELS, OUTREACH_LENGTHS, OUTREACH_TONES } from "@/lib/types";
import { generateOutreachForProspect } from "@/server/ai/outreach";

export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[id]/outreach">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const parsed = z
    .object({ channel: z.enum(OUTREACH_CHANNELS), tone: z.enum(OUTREACH_TONES), length: z.enum(OUTREACH_LENGTHS), language: z.string().max(5).optional(), extraContext: z.string().max(1000).optional() })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  try {
    const message = await generateOutreachForProspect({ prospectId: id, userId: user.id, ...parsed.data });
    return Response.json(message, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
