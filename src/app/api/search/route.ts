import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json([]);
  const rows = await prisma.prospect.findMany({
    where: {
      userId: user.id,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { domain: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { industry: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ opportunityScore: { sort: "desc", nulls: "last" } }],
    take: 12,
    select: { id: true, name: true, domain: true, email: true, city: true, industry: true, opportunityScore: true },
  });
  return Response.json(rows);
}
