import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { isRemoteRef } from "@/server/storage";

const KINDS = { desktop: "screenshotDesktop", mobile: "screenshotMobile", full: "screenshotFull" } as const;

export async function GET(req: Request, ctx: RouteContext<"/api/screenshots/[prospectId]/[kind]">) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const { prospectId, kind } = await ctx.params;
  const field = KINDS[kind as keyof typeof KINDS];
  if (!field) return new Response("Not found", { status: 404 });
  const analysis = await prisma.websiteAnalysis.findFirst({
    where: { prospectId, prospect: { userId: user.id } },
    select: { [field]: true, updatedAt: true },
  });
  const rel = analysis?.[field] as string | null | undefined;
  if (!rel) return new Response("Not found", { status: 404 });
  // Blob-hosted screenshot: redirect to the (immutable, unguessable) public URL.
  if (isRemoteRef(rel)) return Response.redirect(rel, 302);
  const root = path.resolve(env.storageDir);
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root)) return new Response("Forbidden", { status: 403 });
  try {
    const s = await stat(abs);
    const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "content-type": abs.endsWith(".jpg") || abs.endsWith(".jpeg") ? "image/jpeg" : "image/png",
        "content-length": String(s.size),
        "cache-control": "private, max-age=3600",
        etag: `"${s.mtimeMs}"`,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
