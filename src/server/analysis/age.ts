import type { AgeAssessment, HtmlChecks, DomMetrics, MobileMetrics, HttpProbe } from "./types";

/** Signals that a website is likely outdated. Never an exact build year. */
export function assessAge(input: { html: HtmlChecks | null; dom: DomMetrics | null; mobile: MobileMetrics | null; probe: HttpProbe }): AgeAssessment {
  const signals: string[] = [];
  const { html, dom, mobile, probe } = input;
  if (!html) return { signals, verdict: "unknown" };
  const year = new Date().getFullYear();

  if (html.copyrightYear && html.copyrightYear <= year - 3) signals.push(`Copyright year ${html.copyrightYear}`);
  if (!html.hasViewport) signals.push("No viewport meta tag (not built for mobile)");
  if (mobile?.mobileHorizontalOverflow) signals.push("Layout overflows on a 375px screen");
  for (const lib of html.jsLibraries) {
    if (lib.name === "jQuery" && lib.version && /^1\./.test(lib.version)) signals.push(`jQuery ${lib.version} (2010-era library)`);
    if (lib.name === "Bootstrap" && lib.version && /^[23]\./.test(lib.version)) signals.push(`Bootstrap ${lib.version} (legacy version)`);
    if (["MooTools", "Prototype", "Scriptaculous", "AngularJS"].includes(lib.name)) signals.push(`${lib.name} (discontinued library)`);
  }
  for (const m of html.legacyMarkup) if (m !== "no viewport meta") signals.push(`Legacy markup: ${m}`);
  if (!probe.isHttps) signals.push("Served over HTTP without SSL");
  if (dom && !dom.usesWebFonts && dom.fontFamilies.some((f) => /arial|verdana|times|tahoma|georgia/i.test(f))) signals.push("System fonts only (Arial/Verdana/Times)");
  if (html.ogTags && Object.keys(html.ogTags).length === 0 && !html.hasFavicon) signals.push("No Open Graph tags and no favicon");
  if (html.title && /home\s*page|welkom op|welcome to (our|my) (web)?site|index/i.test(html.title)) signals.push("Generic page title");

  let verdict: AgeAssessment["verdict"];
  const strong = signals.filter((s) => /Copyright|viewport|overflows|jQuery 1|Bootstrap|Legacy markup|HTTP without/.test(s)).length;
  if (signals.length >= 3 || strong >= 2) verdict = "likely_outdated";
  else if (signals.length >= 1) verdict = "possibly_outdated";
  else verdict = "modern";
  return { signals, verdict };
}
