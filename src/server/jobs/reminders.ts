import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendMail } from "@/server/mail/send";
import { buildFollowUpReminder } from "@/server/mail/follow-up-reminder";

const OPEN_STATUSES = ["NEW", "QUALIFIED", "CONTACTED", "REPLIED", "FOLLOW_UP", "MEETING_BOOKED"] as const;

/**
 * Sends one reminder email per prospect whose follow-up date has arrived.
 * Idempotent: a prospect is reminded once per followUpAt value
 * (followUpReminderSentAt is reset whenever followUpAt changes).
 */
export async function sendDueFollowUpReminders(now = new Date()) {
  if (!isMailConfigured()) {
    console.log("[reminders] mail not configured; skipping");
    return { sent: 0, skipped: true };
  }
  const settings = await prisma.userSettings.findMany({ where: { followUpReminders: true, notificationEmail: { not: null } } });
  let sent = 0;
  for (const s of settings) {
    if (!s.notificationEmail) continue;
    const due = await prisma.prospect.findMany({
      where: { userId: s.userId, followUpAt: { lte: now }, status: { in: [...OPEN_STATUSES] }, OR: [{ followUpReminderSentAt: null }, { followUpReminderSentAt: { lt: prisma.prospect.fields.followUpAt } }] },
      orderBy: { followUpAt: "asc" },
      take: 50,
      select: {
        id: true, name: true, city: true, status: true, opportunityScore: true, contactedAt: true, followUpAt: true, website: true,
        notes: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
        outreach: { where: { isFollowUp: true }, orderBy: { followUpIndex: "asc" }, select: { followUpIndex: true, followUpAfterDays: true } },
      },
    });
    const language = s.outreachLanguage === "nl" ? "nl" : "en";
    for (const p of due) {
      const daysSince = p.contactedAt ? Math.round((now.getTime() - p.contactedAt.getTime()) / 86_400_000) : null;
      const suggested = p.outreach.find((o) => daysSince != null && (o.followUpAfterDays ?? 0) <= daysSince) ?? p.outreach[0];
      const mail = buildFollowUpReminder({ prospect: p, lastNote: p.notes[0]?.body ?? null, followUpIndex: suggested?.followUpIndex ?? null, language, recipientName: s.senderName });
      try {
        const r = await sendMail({ to: s.notificationEmail, ...mail });
        await prisma.prospect.update({ where: { id: p.id }, data: { followUpReminderSentAt: now } });
        sent++;
        console.log(`[reminders] sent for ${p.name} → ${s.notificationEmail} via ${r.transport}`);
      } catch (err) {
        console.error(`[reminders] failed for ${p.name}:`, (err as Error).message);
      }
    }
  }
  return { sent, skipped: false };
}
