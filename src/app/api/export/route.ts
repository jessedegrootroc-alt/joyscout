import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { buildExport } from "@/server/export/build";

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const parsed = z.object({ ids: z.array(z.string()).min(1).max(5000), format: z.enum(["xlsx", "csv"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const { buffer, contentType, filename } = await buildExport(user.id, parsed.data.ids, parsed.data.format);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": contentType,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
