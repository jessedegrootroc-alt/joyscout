import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { enqueueAi, enqueueAnalyze } from "@/server/jobs/queue";

/** Re-run the website analysis. `?ai=1` forces the AI analysis regardless of the cost gate. */
export async function POST(req: Request, ctx: RouteContext<"/api/prospects/[id]/reanalyze">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  const prospect = await prisma.prospect.findFirst({ where: { id, userId: user.id }, select: { id: true, website: true } });
  if (!prospect) return Response.json({ error: "Not found" }, { status: 404 });
  if (!prospect.website) return Response.json({ error: "This prospect has no website to analyse" }, { status: 400 });
  const withAi = new URL(req.url).searchParams.get("ai") === "1";
  await prisma.prospect.update({ where: { id }, data: { analysisStatus: "PENDING", analysisError: null } });
  if (withAi) await enqueueAi({ prospectId: id, force: true });
  else await enqueueAnalyze({ prospectId: id, force: true }, 100);
  return Response.json({ ok: true });
}
