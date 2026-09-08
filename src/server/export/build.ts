import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUS_LABEL, type LeadStatusKey, type IssueRecord } from "@/lib/types";
import { logActivity } from "@/server/prospects/activity";

export const EXPORT_COLUMNS: { key: string; header: string; width: number }[] = [
  { key: "company", header: "Company", width: 32 },
  { key: "website", header: "Website", width: 34 },
  { key: "email", header: "Email", width: 30 },
  { key: "phone", header: "Phone", width: 18 },
  { key: "address", header: "Address", width: 36 },
  { key: "city", header: "City", width: 18 },
  { key: "country", header: "Country", width: 8 },
  { key: "industry", header: "Industry", width: 20 },
  { key: "googleRating", header: "Google Rating", width: 12 },
  { key: "reviews", header: "Reviews", width: 10 },
  { key: "googleMapsUrl", header: "Google Maps URL", width: 40 },
  { key: "websiteScore", header: "Website Score", width: 12 },
  { key: "seoScore", header: "SEO Score", width: 10 },
  { key: "uxScore", header: "UX Score", width: 10 },
  { key: "performanceScore", header: "Performance Score", width: 14 },
  { key: "conversionScore", header: "Conversion Score", width: 14 },
  { key: "mobileScore", header: "Mobile Score", width: 12 },
  { key: "designScore", header: "Design Score", width: 12 },
  { key: "opportunityScore", header: "Opportunity Score", width: 14 },
  { key: "labels", header: "Priority Labels", width: 30 },
  { key: "cms", header: "CMS", width: 14 },
  { key: "criticalIssues", header: "Critical Issues", width: 60 },
  { key: "insights", header: "Smart Insights", width: 60 },
  { key: "recommendedService", header: "Recommended Service", width: 26 },
  { key: "generatedOutreach", header: "Generated Outreach", width: 80 },
  { key: "leadStatus", header: "Lead Status", width: 14 },
  { key: "notes", header: "Notes", width: 60 },
  { key: "followUpAt", header: "Follow-up Date", width: 14 },
  { key: "contactedAt", header: "Contacted Date", width: 14 },
  { key: "dateFound", header: "Date Found", width: 14 },
  { key: "source", header: "Data Source", width: 14 },
];

export async function fetchExportRows(userId: string, ids: string[]) {
  const prospects = await prisma.prospect.findMany({
    where: { userId, id: { in: ids } },
    orderBy: [{ opportunityScore: { sort: "desc", nulls: "last" } }],
    include: {
      analysis: { select: { issues: true, cms: true } },
      notes: { orderBy: { createdAt: "desc" }, select: { body: true, createdAt: true } },
      outreach: { where: { isFollowUp: false }, orderBy: { createdAt: "desc" }, take: 1, select: { body: true, subject: true, channel: true } },
    },
  });
  return prospects.map((p) => {
    const issues = ((p.analysis?.issues as IssueRecord[] | null) ?? []).filter((i) => i.severity === "critical" || i.severity === "high");
    const outreach = p.outreach[0];
    return {
      company: p.name,
      website: p.website ?? "No website found",
      email: p.email ?? "",
      phone: p.phone ?? "",
      address: p.address ?? "",
      city: p.city ?? "",
      country: p.countryCode ?? "",
      industry: p.industry,
      googleRating: p.googleRating ?? null,
      reviews: p.googleReviewCount ?? null,
      googleMapsUrl: p.googleMapsUrl ?? "",
      websiteScore: p.hasWebsite ? p.websiteScore : null,
      seoScore: p.hasWebsite ? p.seoScore : null,
      uxScore: p.hasWebsite ? p.uxScore : null,
      performanceScore: p.hasWebsite ? p.performanceScore : null,
      conversionScore: p.hasWebsite ? p.conversionScore : null,
      mobileScore: p.hasWebsite ? p.mobileScore : null,
      designScore: p.hasWebsite ? p.designScore : null,
      opportunityScore: p.opportunityScore,
      labels: p.priorityLabels.join(", "),
      cms: p.platform ?? p.analysis?.cms ?? "",
      criticalIssues: issues.map((i) => i.label).join("; "),
      insights: p.insights.join("; "),
      recommendedService: p.recommendedService ?? "",
      generatedOutreach: outreach ? (outreach.subject ? `Subject: ${outreach.subject}\n\n${outreach.body}` : outreach.body) : "",
      leadStatus: LEAD_STATUS_LABEL[p.status as LeadStatusKey] ?? p.status,
      notes: p.notes.map((n) => `[${n.createdAt.toISOString().slice(0, 10)}] ${n.body}`).join("\n"),
      followUpAt: p.followUpAt ? p.followUpAt.toISOString().slice(0, 10) : "",
      contactedAt: p.contactedAt ? p.contactedAt.toISOString().slice(0, 10) : "",
      dateFound: p.dateFound.toISOString().slice(0, 10),
      source: p.source === "google_places" ? "Google Business" : p.source === "overpass" ? "OpenStreetMap" : p.source,
      _id: p.id,
    };
  });
}

export async function buildExport(userId: string, ids: string[], format: "xlsx" | "csv") {
  const rows = await fetchExportRows(userId, ids);
  const date = new Date().toISOString().slice(0, 10);
  await Promise.allSettled(rows.map((r) => logActivity(r._id, userId, "EXPORTED", `Exported as ${format.toUpperCase()}`)));

  if (format === "csv") {
    const esc = (v: unknown) => {
      if (v == null) return "";
      const s = String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [EXPORT_COLUMNS.map((c) => esc(c.header)).join(",")];
    for (const r of rows) lines.push(EXPORT_COLUMNS.map((c) => esc((r as Record<string, unknown>)[c.key])).join(","));
    // BOM so Excel opens UTF-8 correctly
    const buffer = Buffer.from("\uFEFF" + lines.join("\r\n"), "utf8");
    return { buffer, contentType: "text/csv; charset=utf-8", filename: `joyscrape-prospects-${date}.csv` };
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Joyscrape";
  wb.created = new Date();
  const ws = wb.addWorksheet("Prospects", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = EXPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXPORT_COLUMNS.length } };
  for (const r of rows) {
    const row = ws.addRow(EXPORT_COLUMNS.map((c) => (r as Record<string, unknown>)[c.key] ?? null));
    row.alignment = { vertical: "top", wrapText: false };
    const opp = r.opportunityScore;
    if (opp != null) {
      const cell = row.getCell("opportunityScore");
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opp >= 80 ? "FFFFE4E6" : opp >= 65 ? "FFEDE9FE" : opp >= 40 ? "FFE0F2FE" : "FFF4F4F5" } };
    }
    const ws_ = r.websiteScore;
    if (ws_ != null) {
      const cell = row.getCell("websiteScore");
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ws_ < 30 ? "FFFEE2E2" : ws_ < 50 ? "FFFFEDD5" : ws_ < 70 ? "FFFEF3C7" : "FFD1FAE5" } };
    }
    for (const key of ["website", "googleMapsUrl"] as const) {
      const v = r[key];
      if (v && /^https?:\/\//.test(v)) row.getCell(key).value = { text: v, hyperlink: v };
    }
  }
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: `joyscrape-prospects-${date}.xlsx` };
}
