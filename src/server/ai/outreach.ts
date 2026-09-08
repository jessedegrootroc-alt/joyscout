import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { OutreachChannel } from "@/generated/prisma/enums";
import type { IssueRecord, InsightRecord } from "@/lib/types";
import { generateJson, isAiConfigured } from "./llm";
import { logActivity } from "@/server/prospects/activity";

const outreachSchema = z.object({
  subject: z.string().nullable().describe("Email subject line; null for non-email channels"),
  body: z.string().describe("The complete message, ready to send"),
});

const followUpsSchema = z.object({
  followUps: z
    .array(z.object({ afterDays: z.number().int(), subject: z.string().nullable(), body: z.string() }))
    .length(3),
});

export type OutreachOptions = {
  prospectId: string;
  userId: string;
  channel: OutreachChannel;
  tone: "friendly" | "direct" | "professional" | "casual";
  length: "short" | "medium" | "long";
  language?: string;
  extraContext?: string;
};

const CHANNEL_RULES: Record<OutreachChannel, string> = {
  EMAIL: "Cold email. Include a subject line. Plain text, no markdown. Greeting, 1 personal observation, 1-2 concrete findings, a soft ask (15-min call or free mockup), signature.",
  LINKEDIN: "LinkedIn connection note / DM. No subject. Max ~600 characters for medium, no formal greeting, conversational.",
  WHATSAPP: "WhatsApp message. No subject. Short paragraphs, informal but respectful, max ~500 characters, no links unless essential.",
  PHONE: "Phone call opener script: 3-6 short lines the caller can say naturally, including a hook based on the findings and a permission question. No subject.",
  INSTAGRAM: "Instagram DM. No subject. Very short (max ~400 characters), casual, one compliment + one observation + one question.",
};

const LENGTH_RULES = { short: "Very short: 40-70 words.", medium: "Medium: 80-140 words.", long: "Longer: 150-220 words, still tight." };
const TONE_RULES = { friendly: "Warm and friendly, human, no hype.", direct: "Direct and to the point, confident, no fluff.", professional: "Professional and polished, courteous.", casual: "Casual and relaxed, like a message to a peer." };

export async function buildProspectContext(prospectId: string, userId: string) {
  const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, userId }, include: { analysis: true, outreach: { orderBy: { createdAt: "desc" }, take: 3 } } });
  if (!prospect) throw new Error("Prospect not found");
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const a = prospect.analysis;
  const issues = ((a?.issues as IssueRecord[] | null) ?? []).slice(0, 8);
  const insights = ((a?.insights as InsightRecord[] | null) ?? []).map((i) => i.text);
  const aiIssues = (a?.aiIssues as { title: string; detail: string }[] | null) ?? [];
  const aiOpps = (a?.aiOpportunities as { title: string; detail: string }[] | null) ?? [];
  return {
    prospect,
    settings,
    facts: {
      business: { name: prospect.name, industry: prospect.industry, city: prospect.city, googleRating: prospect.googleRating, googleReviews: prospect.googleReviewCount, website: prospect.website ?? "no website found", phone: prospect.phone, email: prospect.email },
      scores: { website: prospect.websiteScore, seo: prospect.seoScore, mobile: prospect.mobileScore, performance: prospect.performanceScore, conversion: prospect.conversionScore, opportunity: prospect.opportunityScore },
      recommendedService: prospect.recommendedService,
      insights,
      issues: issues.map((i) => `${i.label}${i.detail ? ` (${i.detail})` : ""}`),
      aiIssues: aiIssues.map((i) => `${i.title}: ${i.detail}`),
      aiOpportunities: aiOpps.map((i) => `${i.title}: ${i.detail}`),
      measured: a
        ? {
            httpsMissing: !a.isHttps,
            mobileOverflow: a.mobileHorizontalOverflow,
            psiMobilePerformance: a.psiPerformanceMobile,
            lcpSeconds: a.lcpMs ? Math.round(a.lcpMs / 100) / 10 : null,
            ctaAboveFold: a.ctaAboveFold,
            contactForm: a.hasContactForm,
            socialProof: a.hasSocialProof,
            copyrightYear: a.copyrightYear,
            cms: a.cms,
            ageVerdict: a.ageVerdict,
            metaDescriptionMissing: !a.metaDescription,
            h1Missing: a.h1.length === 0,
            localBusinessSchema: a.hasLocalBusinessSchema,
          }
        : null,
    },
  };
}

function senderBlock(settings: { companyName: string | null; senderName: string | null; senderRole: string | null; services: string[]; signature: string | null } | null) {
  return {
    senderName: settings?.senderName ?? "[Your name]",
    company: settings?.companyName ?? "[Your agency]",
    role: settings?.senderRole ?? null,
    services: settings?.services?.length ? settings.services : ["web design", "SEO", "conversion optimization"],
    signature: settings?.signature ?? null,
  };
}

const SYSTEM = `You write outreach for a web agency that has just audited a local business's online presence.

Non-negotiable rules:
- Use ONLY the facts provided. Never invent numbers, page names or problems. If the rating/reviews are unknown, do not mention them.
- Lead with a genuine, specific observation about THEIR business or website (e.g. rating + review count, a missing quote button above the fold, slow mobile load, no SSL, no website found). Generic openers like "I saw your website and think it could be better" are forbidden.
- Mention at most two concrete findings; translate them into business impact (missed quote requests, calls, trust, local search visibility).
- Offer one clear, low-friction next step. No pressure tactics, no fake urgency, no flattery overload.
- Never claim you already built something unless the sender context says so.
- Write in the requested language; use the local tone (Dutch: "je/jij" for casual/friendly, "u" for professional).
- Sign with the sender name/company provided. Do not add placeholders other than the ones given.`;

export async function generateOutreachForProspect(opts: OutreachOptions) {
  if (!isAiConfigured()) throw new Error("AI is not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env.");
  const { prospect, settings, facts } = await buildProspectContext(opts.prospectId, opts.userId);
  const language = opts.language ?? settings?.outreachLanguage ?? "en";
  const user = [
    `Channel rules: ${CHANNEL_RULES[opts.channel]}`,
    `Tone: ${TONE_RULES[opts.tone]}`,
    `Length: ${LENGTH_RULES[opts.length]}`,
    `Language: ${language === "nl" ? "Dutch" : language === "de" ? "German" : language === "fr" ? "French" : "English"}`,
    ``,
    `# Sender`,
    JSON.stringify(senderBlock(settings), null, 2),
    ``,
    `# Prospect facts (from the audit)`,
    JSON.stringify(facts, null, 2),
    opts.extraContext ? `\n# Extra context from the sender\n${opts.extraContext}` : "",
    ``,
    `Write the ${opts.channel.toLowerCase()} message now.`,
  ].join("\n");

  const { data, model } = await generateJson({ system: SYSTEM, user, schema: outreachSchema, schemaName: "outreach_message", maxTokens: 1500, effort: "low" });
  const message = await prisma.outreachMessage.create({
    data: { prospectId: prospect.id, userId: opts.userId, channel: opts.channel, tone: opts.tone, length: opts.length, subject: opts.channel === "EMAIL" ? data.subject : null, body: data.body.trim(), model },
  });
  await logActivity(prospect.id, opts.userId, "OUTREACH_GENERATED", `${opts.channel.charAt(0) + opts.channel.slice(1).toLowerCase()} outreach generated (${opts.tone}, ${opts.length})`, { outreachId: message.id });
  return message;
}

export async function generateFollowUps(opts: { outreachId: string; userId: string }) {
  if (!isAiConfigured()) throw new Error("AI is not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env.");
  const original = await prisma.outreachMessage.findFirst({ where: { id: opts.outreachId, userId: opts.userId } });
  if (!original) throw new Error("Outreach message not found");
  const { prospect, settings, facts } = await buildProspectContext(original.prospectId, opts.userId);
  const language = settings?.outreachLanguage ?? "en";
  const user = [
    `Write exactly three follow-up messages for the same channel (${original.channel}) after no reply: follow-up 1 after 3 days, follow-up 2 after 7 days, follow-up 3 after 14 days.`,
    `Each follow-up must add something new (a different finding, a small tip, a concrete offer such as a free 3-point improvement list) and be shorter than the original. The third one is a polite, friendly close-out ("I'll stop here") that leaves the door open.`,
    `Tone: ${TONE_RULES[original.tone as keyof typeof TONE_RULES] ?? TONE_RULES.friendly}. Language: ${language === "nl" ? "Dutch" : "English"}. ${original.channel === "EMAIL" ? "Include subjects (reply-style, e.g. 'Re: …')." : "No subjects (null)."}`,
    ``,
    `# Sender`,
    JSON.stringify(senderBlock(settings), null, 2),
    ``,
    `# Original message`,
    original.subject ? `Subject: ${original.subject}\n` : "",
    original.body,
    ``,
    `# Prospect facts`,
    JSON.stringify(facts, null, 2),
  ].join("\n");
  const { data, model } = await generateJson({ system: SYSTEM, user, schema: followUpsSchema, schemaName: "follow_ups", maxTokens: 2500, effort: "low" });
  const created = [];
  for (const [i, f] of data.followUps.entries()) {
    created.push(
      await prisma.outreachMessage.create({
        data: { prospectId: prospect.id, userId: opts.userId, channel: original.channel, tone: original.tone, length: "short", subject: original.channel === "EMAIL" ? f.subject : null, body: f.body.trim(), isFollowUp: true, followUpIndex: i + 1, followUpAfterDays: f.afterDays || [3, 7, 14][i], parentId: original.id, model },
      }),
    );
  }
  await logActivity(prospect.id, opts.userId, "FOLLOW_UP_GENERATED", `3 follow-up messages generated for ${original.channel.toLowerCase()} outreach`);
  return created;
}
