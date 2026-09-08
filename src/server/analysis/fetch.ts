import type { HttpProbe, FetchOutcome } from "./types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 LeadLensBot/0.1";

/** Plain HTTP probe: follows redirects manually to record the chain, detects SSL errors and http→https upgrade. */
export async function probeUrl(inputUrl: string): Promise<HttpProbe> {
  const start = Date.now();
  const base: HttpProbe = {
    url: inputUrl,
    finalUrl: null,
    domain: safeDomain(inputUrl),
    httpStatus: null,
    isHttps: false,
    httpsRedirects: false,
    redirectCount: 0,
    sslError: null,
    responseTimeMs: null,
    htmlBytes: null,
    fetchError: null,
    fetchOutcome: "ok",
    headers: {},
    html: null,
    server: null,
  };
  let current = inputUrl;
  const startedHttp = current.startsWith("http://");
  try {
    for (let hop = 0; hop < 8; hop++) {
      const res = await fetch(current, {
        redirect: "manual",
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "nl,en;q=0.8" },
        signal: AbortSignal.timeout(20_000),
      });
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        base.redirectCount++;
        current = new URL(loc, current).toString();
        continue;
      }
      base.httpStatus = res.status;
      base.finalUrl = current;
      base.domain = safeDomain(current);
      base.isHttps = current.startsWith("https://");
      base.httpsRedirects = startedHttp && base.isHttps;
      res.headers.forEach((v, k) => (base.headers[k.toLowerCase()] = v));
      base.server = res.headers.get("server");
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("text/html") || ct.includes("xml") || ct === "") {
        const text = await res.text();
        base.html = text.slice(0, 3_000_000);
        base.htmlBytes = Buffer.byteLength(text, "utf8");
      }
      base.responseTimeMs = Date.now() - start;
      if (res.status === 403 || res.status === 429 || res.status === 503) {
        const body = (base.html ?? "").toLowerCase();
        base.fetchOutcome = body.includes("captcha") || body.includes("cf-chl") || body.includes("challenge") ? "captcha" : "blocked";
        base.fetchError = `HTTP ${res.status}`;
      } else if (res.status >= 400) {
        base.fetchOutcome = "error";
        base.fetchError = `HTTP ${res.status}`;
      }
      return base;
    }
    base.fetchOutcome = "error";
    base.fetchError = "Too many redirects";
    return base;
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } };
    const code = e.cause?.code ?? "";
    const msg = `${e.name}: ${e.message}${e.cause?.message ? ` (${e.cause.message})` : ""}`;
    base.responseTimeMs = Date.now() - start;
    base.fetchError = msg;
    base.fetchOutcome = classify(code, msg);
    if (base.fetchOutcome === "ssl_error") base.sslError = e.cause?.message ?? msg;
    // If https failed with SSL error, try http fallback once
    if (base.fetchOutcome === "ssl_error" && inputUrl.startsWith("https://")) {
      try {
        const alt = await probeUrl(inputUrl.replace("https://", "http://"));
        if (alt.fetchOutcome === "ok") return { ...alt, sslError: base.sslError, isHttps: false, url: inputUrl };
      } catch {
        /* keep original error */
      }
    }
    return base;
  }
}

function classify(code: string, msg: string): FetchOutcome {
  const m = msg.toLowerCase();
  if (/timeout|timed out|aborterror/.test(m)) return "timeout";
  if (/cert|ssl|tls|self.signed|hostname.*altnames|unable_to_verify/.test(m) || /CERT|SSL|TLS/.test(code)) return "ssl_error";
  if (/enotfound|econnrefused|ehostunreach|enetunreach|getaddrinfo|econnreset/.test(m) || /ENOTFOUND|ECONNREFUSED|ECONNRESET/.test(code)) return "offline";
  return "error";
}

export function safeDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function existsAtPath(baseUrl: string, path: string): Promise<boolean | null> {
  try {
    const u = new URL(path, baseUrl).toString();
    const res = await fetch(u, { method: "GET", headers: { "user-agent": UA }, signal: AbortSignal.timeout(10_000), redirect: "follow" });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const text = (await res.text()).slice(0, 2000).toLowerCase();
    if (path.includes("robots")) return !text.includes("<html") && (text.includes("user-agent") || text.includes("sitemap") || text.includes("disallow") || text.trim() === "");
    if (path.includes("sitemap")) return ct.includes("xml") || text.includes("<urlset") || text.includes("<sitemapindex");
    return true;
  } catch {
    return null;
  }
}

export { UA };
