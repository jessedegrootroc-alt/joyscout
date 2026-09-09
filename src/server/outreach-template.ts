import type { UserSettings } from "@/generated/prisma/client";

/**
 * Deterministic follow-up text used when no AI-generated follow-up exists (or AI is
 * not configured). Short, polite, personal enough to send as-is, and clearly marked
 * in the UI as a template so the user can edit it.
 */
export type TemplateProspect = { name: string; city: string | null; website: string | null; contactedAt: Date | null; recommendedService: string | null; opportunityScore: number | null };

export function buildTemplateFollowUp(p: TemplateProspect, settings: UserSettings | null, index: 1 | 2 | 3 = 1): { subject: string; body: string } {
  const lang = settings?.outreachLanguage === "nl" ? "nl" : "en";
  const sender = settings?.senderName?.trim() || "";
  const company = settings?.companyName?.trim() || "";
  const sig = settings?.signature?.trim() || [sender, company].filter(Boolean).join(" · ");
  const service = p.recommendedService ?? null;

  if (lang === "nl") {
    const subjects = [`Re: ${p.name} – korte vraag`, `Re: nog even over de website van ${p.name}`, `Re: laatste bericht over ${p.name}`];
    const bodies = [
      `Hoi,\n\nVorige week stuurde ik je een bericht over de website van ${p.name}${p.city ? ` in ${p.city}` : ""}. Ik snap dat het druk is, dus even een korte reminder.\n\n${service ? `Mijn voorstel was concreet: ${service.toLowerCase()}. ` : ""}Als je wilt, stuur ik je drie punten die jullie direct kunnen verbeteren, geheel vrijblijvend.\n\nIs dat interessant?\n\n${sig}`,
      `Hoi,\n\nNog een korte opvolging op mijn eerdere bericht over ${p.name}. Ik heb inmiddels een aantal ideeën uitgewerkt${service ? ` voor ${service.toLowerCase()}` : ""} die ik graag in tien minuten laat zien.\n\nZou ergens komende week passen? Ik pas me aan jullie agenda aan.\n\n${sig}`,
      `Hoi,\n\nDit is mijn laatste bericht hierover, ik wil niet blijven aandringen. Mocht het later wel relevant worden om de online uitstraling van ${p.name} aan te pakken, dan weet je me te vinden.\n\nVeel succes en groet,\n${sig}`,
    ];
    return { subject: subjects[index - 1], body: bodies[index - 1] };
  }

  const subjects = [`Re: ${p.name} – quick question`, `Re: following up on ${p.name}'s website`, `Re: last note about ${p.name}`];
  const bodies = [
    `Hi,\n\nLast week I sent you a note about ${p.name}'s website${p.city ? ` in ${p.city}` : ""}. I know things get busy, so here is a quick nudge.\n\n${service ? `My suggestion was specific: ${service.toLowerCase()}. ` : ""}If it helps, I can send over three concrete improvements you could make right away, no strings attached.\n\nWould that be useful?\n\n${sig}`,
    `Hi,\n\nA short follow-up on my earlier message about ${p.name}. I have sketched a few ideas${service ? ` for ${service.toLowerCase()}` : ""} that I could walk you through in ten minutes.\n\nWould sometime next week work? Happy to fit your schedule.\n\n${sig}`,
    `Hi,\n\nThis is my last message on this; I don't want to keep pushing. If improving ${p.name}'s online presence becomes relevant later on, you know where to find me.\n\nAll the best,\n${sig}`,
  ];
  return { subject: subjects[index - 1], body: bodies[index - 1] };
}
