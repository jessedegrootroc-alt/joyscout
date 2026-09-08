import * as cheerio from "cheerio";
import { UA } from "./fetch";
import { socialFromUrl } from "@/server/providers/normalize";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const JUNK = /\.(png|jpe?g|gif|svg|webp|css|js)$|example\.|sentry|wixpress|schema\.org|@2x|@3x|noreply|no-reply|domain\.com|email\.com|yourdomain|w3\.org/i;

export function extractEmails(html: string, domain: string | null): string[] {
  const $ = cheerio.load(html);
  const found = new Set<string>();
  $("a[href^='mailto:']").each((_, el) => {
    const v = ($(el).attr("href") ?? "").replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
    if (v) found.add(v);
  });
  for (const m of html.match(EMAIL_RE) ?? []) found.add(m.toLowerCase());
  const list = [...found].filter((e) => !JUNK.test(e) && e.length < 80);
  // Prefer emails on the business domain, then generic ones.
  return list.sort((a, b) => {
    const ad = domain && a.endsWith(`@${domain}`) ? 0 : 1;
    const bd = domain && b.endsWith(`@${domain}`) ? 0 : 1;
    if (ad !== bd) return ad - bd;
    const rank = (e: string) => (/^(info|contact|hello|hallo|office|kantoor|mail|welkom|sales|admin|hi)@/.test(e) ? 0 : 1);
    return rank(a) - rank(b);
  });
}

export function extractSocial(html: string): Record<string, string> {
  const $ = cheerio.load(html);
  const out: Record<string, string> = {};
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (/share|sharer\.php|intent\/tweet|pin\/create/.test(href)) return;
    const s = socialFromUrl(href);
    if (s && !out[s.network]) out[s.network] = href;
  });
  return out;
}

/** Fetches the contact page (if found) to discover extra emails. Best effort. */
export async function fetchContactPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(12_000), redirect: "follow" });
    if (!res.ok) return null;
    return (await res.text()).slice(0, 1_000_000);
  } catch {
    return null;
  }
}
