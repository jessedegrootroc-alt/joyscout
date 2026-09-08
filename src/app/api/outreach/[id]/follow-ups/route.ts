import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { generateFollowUps } from "@/server/ai/outreach";

export async function POST(req: Request, ctx: RouteContext<"/api/outreach/[id]/follow-ups">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  try {
    const created = await generateFollowUps({ outreachId: id, userId: user.id });
    return Response.json(created, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
