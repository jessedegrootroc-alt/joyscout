import type { RawBusiness } from "./types";

const SOCIAL_HOSTS: Record<string, string> = {
  "facebook.com": "facebook",
  "fb.com": "facebook",
  "instagram.com": "instagram",
  "linkedin.com": "linkedin",
  "twitter.com": "twitter",
  "x.com": "twitter",
  "youtube.com": "youtube",
  "tiktok.com": "tiktok",
  "pinterest.com": "pinterest",
};

/** Normalise a website URL; returns null for social profiles / marketplaces used as "website". */
export function normalizeWebsite(raw: string | null | undefined): { url: string; domain: string } | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".")) return null;
    if (Object.keys(SOCIAL_HOSTS).some((h) => host === h || host.endsWith(`.${h}`))) return null;
    if (/(^|\.)(google|goo\.gl|business\.site|maps\.app)/.test(host) && !host.endsWith("business.site")) return null;
    u.hash = "";
    // strip tracking params
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^fbclid|^gclid/.test(k)) u.searchParams.delete(k);
    return { url: u.toString(), domain: host };
  } catch {
    return null;
  }
}

export function socialFromUrl(url: string): { network: string; url: string } | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    for (const [h, network] of Object.entries(SOCIAL_HOSTS)) {
      if (host === h || host.endsWith(`.${h}`)) return { network, url };
    }
  } catch {
    /* ignore */
  }
  return null;
}

const COUNTRY_DIAL: Record<string, string> = { NL: "31", BE: "32", DE: "49", GB: "44", US: "1", IE: "353", FR: "33", ES: "34", AU: "61", CA: "1" };

/** Best-effort E.164 normalisation for duplicate detection (not for display). */
export function normalizePhone(raw: string | null | undefined, countryCode: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\D/g, "")}`;
  const dial = COUNTRY_DIAL[(countryCode ?? "NL").toUpperCase()] ?? "31";
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `+${dial}${digits}`;
}

export function normalizeName(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(b\.?v\.?|v\.?o\.?f\.?|bv|vof|nv|ltd|llc|inc|gmbh|sarl|eenmanszaak)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeAddress(addr: string | null | undefined) {
  if (!addr) return null;
  return addr.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() || null;
}

export function displayName(b: RawBusiness) {
  return b.name.replace(/\s+/g, " ").trim();
}
