import pLimit from "p-limit";
import { UA } from "./fetch";
import type { LinkCheck } from "./types";

/** Checks a sample of internal links for 4xx/5xx/network failures. */
export async function checkLinks(links: string[], max = 15): Promise<LinkCheck> {
  const sample = [...new Set(links)].filter((l) => !/\.(pdf|zip|jpg|jpeg|png|gif|mp4|docx?)$/i.test(l)).slice(0, max);
  const limit = pLimit(4);
  const broken: string[] = [];
  await Promise.all(
    sample.map((link) =>
      limit(async () => {
        try {
          let res = await fetch(link, { method: "HEAD", headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(8_000) });
          if (res.status === 405 || res.status === 403 || res.status === 501) res = await fetch(link, { method: "GET", headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(8_000) });
          if (res.status >= 400 && res.status !== 403 && res.status !== 429) broken.push(`${link} (${res.status})`);
        } catch (err) {
          const m = (err as Error).name;
          if (m !== "TimeoutError") broken.push(`${link} (${m})`);
        }
      }),
    ),
  );
  return { linksChecked: sample.length, linksBroken: broken.length, brokenLinks: broken.slice(0, 10) };
}
