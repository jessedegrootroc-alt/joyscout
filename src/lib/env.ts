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
  analyzeConcurrency: Number(process.env.ANALYZE_CONCURRENCY || 3),
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
};

export function integrationStatus() {
  return {
    googlePlaces: Boolean(env.googlePlacesKey),
    pagespeed: Boolean(env.pagespeedKey),
    ai: Boolean(env.anthropicKey || env.openaiKey),
    aiProvider: env.anthropicKey && env.aiProvider !== "openai" ? "anthropic" : env.openaiKey ? "openai" : null,
  };
}
