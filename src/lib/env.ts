/** Server-only view on which integrations are configured. Never import in client code. */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  googlePlacesKey: process.env.GOOGLE_PLACES_API_KEY || "",
  pagespeedKey: process.env.PAGESPEED_API_KEY || "",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  openaiKey: process.env.OPENAI_API_KEY || "",
  aiProvider: (process.env.AI_PROVIDER as "anthropic" | "openai" | undefined) || undefined,
  aiModel: process.env.AI_MODEL || "",
  storageDir: process.env.STORAGE_DIR || "./storage",
  blobToken: process.env.BLOB_READ_WRITE_TOKEN || "",
  analyzeConcurrency: Number(process.env.ANALYZE_CONCURRENCY || 3),
  appUrl: process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  // Outgoing mail (follow-up reminders)
  mailTransport: (process.env.MAIL_TRANSPORT as "log" | undefined) || undefined,
  mailFrom: process.env.MAIL_FROM || "",
  resendKey: process.env.RESEND_API_KEY || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
};

export function integrationStatus() {
  return {
    googlePlaces: Boolean(env.googlePlacesKey),
    pagespeed: Boolean(env.pagespeedKey),
    ai: Boolean(env.anthropicKey || env.openaiKey),
    aiProvider: env.anthropicKey && env.aiProvider !== "openai" ? "anthropic" : env.openaiKey ? "openai" : null,
    blob: Boolean(env.blobToken),
    mail: env.mailTransport === "log" || Boolean((env.resendKey || env.smtpHost) && env.mailFrom),
    mailTransport: env.mailTransport === "log" ? "log" : env.resendKey ? "resend" : env.smtpHost ? "smtp" : null,
  };
}
