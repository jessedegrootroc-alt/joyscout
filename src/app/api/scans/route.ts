import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { scanInputSchema } from "@/lib/types";
import { enqueueScan } from "@/server/jobs/queue";
import { INDUSTRY_MAP } from "@/lib/industries";

export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const scans = await prisma.scan.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return Response.json(scans);
}

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const parsed = scanInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const industry = input.industryKey ? INDUSTRY_MAP.get(input.industryKey) : undefined;
  const name = input.name || `${industry?.label.en ?? input.query} · ${input.location}`;

  let savedSearchId: string | undefined;
  if (input.saveSearch) {
    const saved = await prisma.savedSearch.create({
      data: { userId: user.id, name, params: { ...input, saveSearch: undefined, name: undefined }, lastRunAt: new Date(), runCount: 1 },
    });
    savedSearchId = saved.id;
  }

  const scan = await prisma.scan.create({
    data: {
      userId: user.id,
      name,
      query: input.query,
      industryKey: input.industryKey ?? null,
      location: input.location,
      countryCode: input.countryCode,
      radiusKm: input.radiusKm,
      maxResults: input.maxResults,
      filters: input.filters,
      savedSearchId,
    },
  });
  try {
    await enqueueScan(scan.id);
  } catch (err) {
    await prisma.scan.update({ where: { id: scan.id }, data: { status: "FAILED", error: `Could not queue job: ${(err as Error).message}` } });
    return Response.json({ error: "Could not queue the scan. Is the database reachable?" }, { status: 500 });
  }
  return Response.json({ id: scan.id }, { status: 201 });
}
