import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { importInputSchema } from "@/lib/types";
import { parseImportLines } from "@/lib/import-parse";
import { enqueueScan } from "@/server/jobs/queue";
import { INDUSTRY_MAP } from "@/lib/industries";

/** Creates an "import" scan from a pasted list; the worker resolves every line to a business. */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const parsed = importInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  const input = parsed.data;
  const items = parseImportLines(input.text, input.defaultCity);
  if (items.length === 0) return Response.json({ error: "No businesses recognised. Use one per line: “Name, City” or a Facebook page URL." }, { status: 400 });
  if (items.length > 150) return Response.json({ error: "Maximum 150 businesses per import." }, { status: 400 });
  const industry = input.industryKey ? INDUSTRY_MAP.get(input.industryKey) : undefined;
  const source = input.sourceLabel?.trim() || "Imported list";
  const scan = await prisma.scan.create({
    data: {
      userId: user.id,
      name: `${source} · ${items.length} ${items.length === 1 ? "business" : "businesses"}`,
      kind: "import",
      importItems: items,
      query: industry?.label.en ?? source,
      industryKey: industry?.key ?? null,
      location: input.defaultCity?.trim() || "Various",
      countryCode: input.countryCode,
      radiusKm: 15,
      maxResults: items.length,
      filters: { websiteRequired: "any" },
    },
  });
  try {
    await enqueueScan(scan.id);
  } catch (err) {
    await prisma.scan.update({ where: { id: scan.id }, data: { status: "FAILED", error: `Could not queue job: ${(err as Error).message}` } });
    return Response.json({ error: "Could not queue the import. Is the database reachable?" }, { status: 500 });
  }
  return Response.json({ id: scan.id, count: items.length }, { status: 201 });
}
