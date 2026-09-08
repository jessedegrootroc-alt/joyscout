import type { TechDetection } from "./types";

type Rule = { name: string; category: "cms" | "framework" | "analytics" | "pixel" | "hosting" | "ecommerce" | "builder" | "chat" | "library"; html?: RegExp[]; headers?: Record<string, RegExp>; cookies?: RegExp[] };

const RULES: Rule[] = [
  { name: "WordPress", category: "cms", html: [/wp-content\//i, /wp-includes\//i, /<meta name="generator" content="WordPress/i] },
  { name: "WooCommerce", category: "ecommerce", html: [/woocommerce/i] },
  { name: "Elementor", category: "builder", html: [/elementor/i] },
  { name: "Divi", category: "builder", html: [/et_pb_|Divi\//i] },
  { name: "WPBakery", category: "builder", html: [/js_composer|vc_row/i] },
  { name: "Wix", category: "cms", html: [/static\.wixstatic\.com|wix\.com|X-Wix-/i], headers: { "x-wix-request-id": /.+/ } },
  { name: "Squarespace", category: "cms", html: [/squarespace\.com|static1\.squarespace/i] },
  { name: "Shopify", category: "cms", html: [/cdn\.shopify\.com|Shopify\.theme/i], headers: { "x-shopid": /.+/, "x-shopify-stage": /.+/ } },
  { name: "Webflow", category: "cms", html: [/webflow\.com|data-wf-page|assets\.website-files\.com/i] },
  { name: "Joomla", category: "cms", html: [/\/media\/jui\/|<meta name="generator" content="Joomla/i, /\/components\/com_/i] },
  { name: "Drupal", category: "cms", html: [/<meta name="generator" content="Drupal|\/sites\/default\/files\//i], headers: { "x-generator": /Drupal/i, "x-drupal-cache": /.+/ } },
  { name: "Jimdo", category: "cms", html: [/jimdo\.com|jimstatic\.com/i] },
  { name: "Weebly", category: "cms", html: [/weebly\.com|weeblycloud/i] },
  { name: "Strato", category: "cms", html: [/strato-hosting|strato\.de/i] },
  { name: "Odoo", category: "cms", html: [/odoo/i] },
  { name: "TYPO3", category: "cms", html: [/typo3conf|typo3temp|<meta name="generator" content="TYPO3/i] },
  { name: "Craft CMS", category: "cms", headers: { "x-powered-by": /Craft CMS/i } },
  { name: "Duda", category: "cms", html: [/dudamobile|duda\.co|d-cdn/i] },
  { name: "GoDaddy Website Builder", category: "cms", html: [/godaddy|wsimg\.com/i] },
  { name: "SiteW", category: "cms", html: [/sitew\.com/i] },
  { name: "Zyro / Hostinger", category: "cms", html: [/zyrosite|hostingersite/i] },
  { name: "Framer", category: "cms", html: [/framerusercontent\.com|framer\.com/i] },
  { name: "Next.js", category: "framework", html: [/__NEXT_DATA__|\/_next\//i], headers: { "x-powered-by": /Next\.js/i } },
  { name: "Nuxt", category: "framework", html: [/__NUXT__|\/_nuxt\//i] },
  { name: "Gatsby", category: "framework", html: [/___gatsby|gatsby-/i] },
  { name: "React", category: "framework", html: [/data-reactroot|react-dom|__reactContainer/i] },
  { name: "Vue.js", category: "framework", html: [/data-v-[a-f0-9]{8}|vue(?:\.min)?\.js/i] },
  { name: "Angular", category: "framework", html: [/ng-version=|ng-app/i] },
  { name: "Laravel", category: "framework", cookies: [/laravel_session/i, /XSRF-TOKEN/] },
  { name: "ASP.NET", category: "framework", headers: { "x-aspnet-version": /.+/, "x-powered-by": /ASP\.NET/i }, html: [/__VIEWSTATE/] },
  { name: "PHP", category: "framework", headers: { "x-powered-by": /PHP/i }, cookies: [/PHPSESSID/] },
  { name: "Google Analytics", category: "analytics", html: [/googletagmanager\.com\/gtag\/js|google-analytics\.com\/analytics\.js|gtag\('config',\s*'G-|UA-\d{4,}-\d/i] },
  { name: "Google Tag Manager", category: "analytics", html: [/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/] },
  { name: "Hotjar", category: "analytics", html: [/static\.hotjar\.com|hj\('/i] },
  { name: "Microsoft Clarity", category: "analytics", html: [/clarity\.ms/i] },
  { name: "Matomo", category: "analytics", html: [/matomo\.js|piwik\.js/i] },
  { name: "Plausible", category: "analytics", html: [/plausible\.io\/js/i] },
  { name: "Meta Pixel", category: "pixel", html: [/connect\.facebook\.net\/[a-z_]+\/fbevents\.js|fbq\('init'/i] },
  { name: "LinkedIn Insight", category: "pixel", html: [/snap\.licdn\.com|_linkedin_partner_id/i] },
  { name: "TikTok Pixel", category: "pixel", html: [/analytics\.tiktok\.com/i] },
  { name: "Google Ads", category: "pixel", html: [/googleadservices\.com|AW-\d{6,}/] },
  { name: "Pinterest Tag", category: "pixel", html: [/pintrk\(/i] },
  { name: "Tawk.to", category: "chat", html: [/embed\.tawk\.to/i] },
  { name: "Intercom", category: "chat", html: [/widget\.intercom\.io/i] },
  { name: "Crisp", category: "chat", html: [/client\.crisp\.chat/i] },
  { name: "HubSpot", category: "analytics", html: [/js\.hs-scripts\.com|hs-analytics/i] },
  { name: "Cloudflare", category: "hosting", headers: { server: /cloudflare/i, "cf-ray": /.+/ } },
  { name: "Vercel", category: "hosting", headers: { server: /vercel/i, "x-vercel-id": /.+/ } },
  { name: "Netlify", category: "hosting", headers: { server: /netlify/i, "x-nf-request-id": /.+/ } },
  { name: "AWS", category: "hosting", headers: { server: /awselb|amazons3/i, "x-amz-cf-id": /.+/ } },
  { name: "Google Cloud", category: "hosting", headers: { server: /gws|Google Frontend/i, via: /google/i } },
  { name: "LiteSpeed", category: "hosting", headers: { server: /litespeed/i } },
  { name: "Nginx", category: "hosting", headers: { server: /nginx/i } },
  { name: "Apache", category: "hosting", headers: { server: /apache/i } },
  { name: "IIS", category: "hosting", headers: { server: /microsoft-iis/i } },
  { name: "WP Engine", category: "hosting", headers: { "x-powered-by": /WP Engine/i } },
  { name: "Kinsta", category: "hosting", headers: { "x-kinsta-cache": /.+/ } },
  { name: "SiteGround", category: "hosting", headers: { "x-cache-enabled": /.+/, host: /siteground/i } },
  { name: "TransIP", category: "hosting", headers: { server: /transip/i } },
  { name: "Antagonist", category: "hosting", headers: { server: /antagonist/i } },
];

export function detectTech(html: string, headers: Record<string, string>, cookies: string[]): TechDetection {
  const found: TechDetection["technologies"] = [];
  const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  for (const rule of RULES) {
    let evidence: string | null = null;
    for (const re of rule.html ?? []) {
      const m = html.match(re);
      if (m) {
        evidence = `html: ${m[0].slice(0, 40)}`;
        break;
      }
    }
    if (!evidence && rule.headers) {
      for (const [k, re] of Object.entries(rule.headers)) {
        if (h[k] && re.test(h[k])) {
          evidence = `header ${k}: ${h[k].slice(0, 40)}`;
          break;
        }
      }
    }
    if (!evidence && rule.cookies) {
      for (const re of rule.cookies) {
        const c = cookies.find((x) => re.test(x));
        if (c) {
          evidence = `cookie: ${c.slice(0, 30)}`;
          break;
        }
      }
    }
    if (evidence) found.push({ name: rule.name, category: rule.category, evidence });
  }
  const pick = (cat: Rule["category"]) => found.filter((f) => f.category === cat).map((f) => f.name);
  const cmsList = pick("cms");
  const cms = cmsList[0] ?? null;
  const frameworks = pick("framework");
  const hostingList = pick("hosting");
  // Prefer a real host/CDN over the generic web server
  const hosting = hostingList.find((n) => !["Nginx", "Apache", "IIS", "LiteSpeed"].includes(n)) ?? hostingList[0] ?? null;
  return {
    cms: cms ?? (frameworks.length ? "Custom" : html.length > 0 ? "Custom" : null),
    framework: frameworks[0] ?? null,
    analytics: [...pick("analytics")],
    pixels: pick("pixel"),
    hosting,
    server: h.server ?? null,
    technologies: found,
  };
}

/** Maps detected CMS to the platform filter vocabulary. */
export function platformFromTech(tech: TechDetection | null): string {
  if (!tech?.cms) return "Unknown";
  const known = ["WordPress", "Wix", "Squarespace", "Shopify", "Webflow", "Joomla", "Drupal", "Jimdo"];
  return known.includes(tech.cms) ? tech.cms : "Custom";
}
