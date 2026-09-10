import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put, del } from "@vercel/blob";
import { env } from "@/lib/env";

/**
 * Screenshot storage. With BLOB_READ_WRITE_TOKEN set, files go to Vercel Blob (public,
 * unguessable URLs) so the web app and the worker can run on different machines.
 * Without it, files are written under STORAGE_DIR and served by the screenshots route.
 * The stored reference is either an absolute https URL (blob) or a relative path (disk).
 */
export function blobEnabled() {
  return Boolean(env.blobToken);
}

export async function saveScreenshot(prospectId: string, name: string, data: Buffer, contentType = "image/jpeg"): Promise<string> {
  if (blobEnabled()) {
    const blob = await put(`screenshots/${prospectId}/${name}`, data, { access: "public", addRandomSuffix: true, contentType, token: env.blobToken, cacheControlMaxAge: 60 * 60 * 24 * 365 });
    return blob.url;
  }
  const dir = path.join(env.storageDir, "screenshots", prospectId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), data);
  return path.join("screenshots", prospectId, name);
}

export function isRemoteRef(ref: string | null | undefined): ref is string {
  return Boolean(ref && /^https?:\/\//.test(ref));
}

/** Best-effort cleanup of an old blob when a screenshot is replaced. */
export async function deleteScreenshot(ref: string | null | undefined) {
  if (!isRemoteRef(ref) || !env.blobToken) return;
  await del(ref, { token: env.blobToken }).catch(() => {});
}
