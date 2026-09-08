import * as cheerio from "cheerio";
import type { HtmlChecks } from "./types";

const LEGACY_TAGS = ["font", "center", "marquee", "blink", "frameset", "frame", "applet", "bgsound"];

export function analyzeHtml(html: string, pageUrl: string): HtmlChecks {
  const $ = cheerio.load(html);
  const base = safeUrl(pageUrl);
  const host = base?.hostname.replace(/^www\./, "") ?? "";

  const title = $("head > title").first().text().trim() || $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const h1 = $("h1")
    .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
    .get()
    .filter(Boolean);

  const headingOutline: { level: number; text: string }[] = [];
  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    const level = Number((el as { tagName: string }).tagName.slice(1));
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headingOutline.push({ level, text: text.slice(0, 120) });
  });
  let headingSkips = 0;
  for (let i = 1; i < headingOutline.length; i++) if (headingOutline[i].level - headingOutline[i - 1].level > 1) headingSkips++;

  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const robotsMeta = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();
  const isIndexable = !robotsMeta.includes("noindex");
  const lang = $("html").attr("lang")?.trim() || null;
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const hasFavicon = $('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length > 0;

  const schemaTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      collectTypes(json, schemaTypes);
    } catch {
      /* invalid JSON-LD */
    }
  });
  $("[itemtype]").each((_, el) => {
    const t = $(el).attr("itemtype")?.split("/").pop();
    if (t) schemaTypes.add(t);
  });
  const LOCAL_TYPES = /LocalBusiness|Dentist|Plumber|Electrician|RoofingContractor|HomeAndConstructionBusiness|GeneralContractor|HousePainter|Restaurant|HairSalon|BeautySalon|RealEstateAgent|LegalService|Attorney|Physician|MedicalBusiness|AutoRepair|AutoDealer|Store|ProfessionalService|Organization/;
  const hasLocalBusinessSchema = [...schemaTypes].some((t) => LOCAL_TYPES.test(t) && !/^(Organization|WebSite|WebPage|BreadcrumbList)$/.test(t)) || [...schemaTypes].some((t) => /LocalBusiness/.test(t));

  const ogTags: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const p = $(el).attr("property");
    const c = $(el).attr("content");
    if (p && c) ogTags[p] = c;
  });

  const imgs = $("img");
  const imagesTotal = imgs.length;
  let imagesMissingAlt = 0;
  imgs.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt == null || alt.trim() === "") imagesMissingAlt++;
  });

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText ? bodyText.split(" ").length : 0;
  const yearMatches = [...bodyText.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1])).filter((y) => y > 1995 && y <= new Date().getFullYear() + 1);
  const copyrightYear = yearMatches.length ? Math.max(...yearMatches) : null;

  const legacyMarkup: string[] = [];
  for (const tag of LEGACY_TAGS) if ($(tag).length) legacyMarkup.push(`<${tag}>`);
  if ($("table[width], table[border], table[cellpadding]").length > 2) legacyMarkup.push("table layout");
  if ($("[bgcolor], [align]").length > 3) legacyMarkup.push("presentational attributes");
  if (/<meta[^>]+content=["'][^"']*text\/html;\s*charset=iso-8859/i.test(html)) legacyMarkup.push("ISO-8859 charset");
  if ($('object[type*="flash"], embed[src$=".swf"]').length) legacyMarkup.push("Flash");
  if (!hasViewport) legacyMarkup.push("no viewport meta");

  const jsLibraries: { name: string; version: string | null }[] = [];
  $("script[src]").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    const m = src.match(/jquery(?:[.-](\d+\.\d+(?:\.\d+)?))?(?:\.min)?\.js/i);
    if (m && !/jquery[.-]?(ui|migrate|form|validate)/i.test(src)) jsLibraries.push({ name: "jQuery", version: m[1] ?? null });
    const b = src.match(/bootstrap(?:[.-](\d+\.\d+(?:\.\d+)?))?(?:\.bundle)?(?:\.min)?\.js/i);
    if (b) jsLibraries.push({ name: "Bootstrap", version: b[1] ?? null });
    const bc = src.match(/bootstrap\/(\d+\.\d+(?:\.\d+)?)/i);
    if (bc && !b) jsLibraries.push({ name: "Bootstrap", version: bc[1] });
    if (/angular(?:\.min)?\.js/i.test(src)) jsLibraries.push({ name: "AngularJS", version: src.match(/angular(?:js)?\/(\d+\.\d+)/i)?.[1] ?? null });
    if (/mootools/i.test(src)) jsLibraries.push({ name: "MooTools", version: null });
    if (/prototype\.js/i.test(src)) jsLibraries.push({ name: "Prototype", version: null });
    if (/scriptaculous/i.test(src)) jsLibraries.push({ name: "Scriptaculous", version: null });
  });
  const jq = html.match(/jQuery v(\d+\.\d+\.\d+)/) ?? html.match(/jquery\/(\d+\.\d+\.\d+)/i);
  if (jq && !jsLibraries.some((l) => l.name === "jQuery" && l.version)) jsLibraries.push({ name: "jQuery", version: jq[1] });

  const internalLinks = new Set<string>();
  const externalLinks = new Set<string>();
  let contactPageUrl: string | null = null;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")?.trim();
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:|whatsapp:|sms:)/i.test(href)) return;
    const abs = safeUrl(href, pageUrl);
    if (!abs) return;
    const h = abs.hostname.replace(/^www\./, "");
    abs.hash = "";
    if (h === host) {
      internalLinks.add(abs.toString());
      const text = $(el).text().toLowerCase();
      if (!contactPageUrl && /contact|kontakt|contacto|offerte|quote|afspraak/.test(`${abs.pathname} ${text}`)) contactPageUrl = abs.toString();
    } else externalLinks.add(abs.toString());
  });

  return {
    title,
    metaDescription,
    h1,
    headingOutline: headingOutline.slice(0, 80),
    headingSkips,
    canonical,
    schemaTypes: [...schemaTypes],
    hasLocalBusinessSchema,
    ogTags,
    hasViewport,
    imagesTotal,
    imagesMissingAlt,
    isIndexable,
    lang,
    hasFavicon,
    copyrightYear,
    legacyMarkup,
    jsLibraries: dedupeLibs(jsLibraries),
    internalLinks: [...internalLinks].slice(0, 300),
    externalLinks: [...externalLinks].slice(0, 100),
    contactPageUrl,
    wordCount,
    hasFormTag: $("form").length > 0,
  };
}

function collectTypes(node: unknown, out: Set<string>) {
  if (!node) return;
  if (Array.isArray(node)) return node.forEach((n) => collectTypes(n, out));
  if (typeof node === "object") {
    const o = node as Record<string, unknown>;
    const t = o["@type"];
    if (typeof t === "string") out.add(t);
    if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
    for (const k of ["@graph", "mainEntity", "itemListElement", "hasPart"]) if (o[k]) collectTypes(o[k], out);
  }
}

function dedupeLibs(libs: { name: string; version: string | null }[]) {
  const map = new Map<string, string | null>();
  for (const l of libs) if (!map.has(l.name) || (!map.get(l.name) && l.version)) map.set(l.name, l.version);
  return [...map].map(([name, version]) => ({ name, version }));
}

function safeUrl(href: string, base?: string) {
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}
