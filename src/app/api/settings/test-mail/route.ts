import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendMail } from "@/server/mail/send";
import { buildFollowUpReminder } from "@/server/mail/follow-up-reminder";

/** Sends a sample follow-up reminder to the given address so the mail setup can be verified. */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const parsed = z.object({ to: z.string().email() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter a valid email address first" }, { status: 400 });
  if (!isMailConfigured()) return Response.json({ error: "Mail is not configured on the server. Set RESEND_API_KEY or SMTP_HOST plus MAIL_FROM." }, { status: 400 });
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const sample = await prisma.prospect.findFirst({ where: { userId: user.id }, orderBy: { opportunityScore: { sort: "desc", nulls: "last" } }, select: { id: true, name: true, city: true, status: true, opportunityScore: true, contactedAt: true, followUpAt: true, website: true } });
  const prospect = sample ?? { id: "example", name: "Example Roofing BV", city: "Amsterdam", status: "CONTACTED", opportunityScore: 78, contactedAt: new Date(Date.now() - 3 * 86_400_000), followUpAt: new Date(), website: null };
  const mail = buildFollowUpReminder({ prospect, lastNote: "Test reminder from Settings", followUpIndex: 1, language: settings?.outreachLanguage === "nl" ? "nl" : "en" });
  try {
    const r = await sendMail({ to: parsed.data.to, ...mail, subject: `[Test] ${mail.subject}` });
    return Response.json({ ok: true, transport: r.transport });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
