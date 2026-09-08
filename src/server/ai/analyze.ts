import { z } from "zod";
import { generateJson } from "./llm";
import type { CheckRecord, IssueRecord, InsightRecord } from "@/lib/types";

export const aiAnalysisSchema = z.object({
  summary: z.string().describe("2-3 sentence plain-language summary of the website and the business opportunity"),
  strengths: z.array(z.string()).min(2).max(5).describe("3-5 concrete things that work well; reference specific observed facts"),
  issues: z.array(z.object({ title: z.string(), detail: z.string(), severity: z.enum(["critical", "high", "medium", "low"]) })).min(3).max(8).describe("Most important problems, concrete and specific"),
  opportunities: z.array(z.object({ title: z.string(), detail: z.string() })).min(2).max(6).describe("Concrete improvement opportunities tied to the business"),
  recommendedService: z.enum([
    "Complete website redesign",
    "New website",
    "Landing page",
    "SEO optimization",
    "Local SEO",
    "Conversion optimization",
    "Mobile redesign",
    "Performance optimization",
    "Google Business optimization",
  ]),
  designImpression: z.number().int().min(0).max(100).describe("Visual design quality impression 0-100 based ONLY on described facts (typography, layout signals, age signals). 50 = average small-business site."),
});
export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;

export type AiAnalysisContext = {
  business: { name: string; industry: string; city: string | null; countryCode: string | null; rating: number | null; reviewCount: number | null; website: string | null; phone: string | null; email: string | null };
  scores: Record<string, number | null>;
  checks: CheckRecord[];
  issues: IssueRecord[];
  insights: InsightRecord[];
  facts: Record<string, unknown>;
  language: string;
};

const SYSTEM = `You are a senior web strategist at a digital agency. You review small-business websites for webdesigners, SEO specialists and agencies who want to pitch improvements.

Rules:
- Base every statement ONLY on the measured facts provided. Do not invent features, numbers or visuals you were not given.
- Be concrete and specific. Bad: "The website could be more modern." Good: "The homepage shows no call-to-action above the fold, so a visitor looking for a quote has to hunt through the menu."
- Tie observations to business impact (leads, quotes, calls, trust, local search).
- Strengths must be real strengths found in the data (e.g. strong Google rating, HTTPS present, fast TTFB). If there are few, say so briefly.
- Write in the requested language. Keep each item to one or two sentences.
- designImpression is your qualitative estimate derived from the described signals only; it is displayed as an "AI observation", never as a measured fact.`;

export async function runAiAnalysis(ctx: AiAnalysisContext): Promise<{ data: AiAnalysis; model: string }> {
  const user = [
    `Language for the output: ${ctx.language === "nl" ? "Dutch" : "English"}.`,
    ``,
    `# Business (source: Google Business / directory)`,
    JSON.stringify(ctx.business, null, 2),
    ``,
    `# Measured scores (0-100; computed by the scoring engine, not by you)`,
    JSON.stringify(ctx.scores),
    ``,
    `# Checks (passed=true/false/null=not measured)`,
    ctx.checks.map((c) => `- [${c.passed === null ? "n/a" : c.passed ? "PASS" : "FAIL"}] ${c.category}/${c.key}: ${c.label}${c.value != null && c.value !== "" ? ` (${String(c.value).slice(0, 120)})` : ""}`).join("\n"),
    ``,
    `# Issues detected`,
    ctx.issues.map((i) => `- (${i.severity}) ${i.label}${i.detail ? ` — ${i.detail.slice(0, 160)}` : ""}`).join("\n") || "- none",
    ``,
    `# Rule-based insights`,
    ctx.insights.map((i) => `- ${i.text}`).join("\n") || "- none",
    ``,
    `# Additional facts`,
    JSON.stringify(ctx.facts, null, 2),
    ``,
    `Produce the JSON analysis.`,
  ].join("\n");
  return generateJson({ system: SYSTEM, user, schema: aiAnalysisSchema, schemaName: "website_analysis", maxTokens: 3000, effort: "low" });
}
