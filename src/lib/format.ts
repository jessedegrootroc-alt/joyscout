import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";

export function fmtDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return format(date, withTime ? "d MMM yyyy, HH:mm" : "d MMM yyyy");
}

export function fmtRelative(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function fmtNumber(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US").format(n);
}

export function scoreTone(score: number | null | undefined): "none" | "bad" | "poor" | "ok" | "good" {
  if (score == null) return "none";
  if (score < 30) return "bad";
  if (score < 50) return "poor";
  if (score < 70) return "ok";
  return "good";
}

export function opportunityTone(score: number | null | undefined): "none" | "low" | "mid" | "high" | "hot" {
  if (score == null) return "none";
  if (score >= 80) return "hot";
  if (score >= 65) return "high";
  if (score >= 40) return "mid";
  return "low";
}

export function domainFromUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function truncate(s: string | null | undefined, n = 80) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
