import nodemailer from "nodemailer";
import { env } from "@/lib/env";

/**
 * Outgoing mail. Two transports, picked from the environment:
 *   - RESEND_API_KEY            → Resend HTTP API (no SMTP needed)
 *   - SMTP_HOST (+PORT/USER/PASS) → any SMTP server via nodemailer
 * MAIL_FROM sets the sender ("Joyscrape <hello@yourdomain.nl>").
 * MAIL_TRANSPORT=log prints mails to the worker log instead of sending (dev).
 */
export type MailMessage = { to: string; subject: string; html: string; text: string };

export function mailTransportKind(): "resend" | "smtp" | "log" | null {
  if (env.mailTransport === "log") return "log";
  if (env.resendKey) return "resend";
  if (env.smtpHost) return "smtp";
  return null;
}

export function isMailConfigured() {
  return mailTransportKind() !== null && Boolean(env.mailFrom || mailTransportKind() === "log");
}

export async function sendMail(msg: MailMessage): Promise<{ id: string | null; transport: string }> {
  const kind = mailTransportKind();
  if (!kind) throw new Error("Mail is not configured. Set RESEND_API_KEY or SMTP_HOST, plus MAIL_FROM.");
  const from = env.mailFrom || "Joyscrape <no-reply@localhost>";

  if (kind === "log") {
    console.log(`[mail:log] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    return { id: null, transport: "log" };
  }

  if (kind === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) throw new Error(`Resend ${res.status}: ${data.message ?? data.name ?? "request failed"}`);
    return { id: data.id ?? null, transport: "resend" };
  }

  const transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });
  const info = await transporter.sendMail({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
  return { id: info.messageId ?? null, transport: "smtp" };
}
