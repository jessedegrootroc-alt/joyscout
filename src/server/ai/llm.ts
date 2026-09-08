import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import OpenAI from "openai";
import type { z } from "zod";
import { env } from "@/lib/env";

/**
 * Thin LLM abstraction: structured JSON generation against a zod schema.
 * Anthropic is preferred when ANTHROPIC_API_KEY is present; OpenAI otherwise.
 * AI is used for qualitative analysis + outreach copy only – never for scores.
 */
export type LlmProvider = "anthropic" | "openai";

export function resolveProvider(): { provider: LlmProvider; model: string } | null {
  const preferred = env.aiProvider;
  if ((preferred === "anthropic" || !preferred) && env.anthropicKey) return { provider: "anthropic", model: env.aiModel || "claude-opus-5" };
  if ((preferred === "openai" || !preferred) && env.openaiKey) return { provider: "openai", model: env.aiModel || "gpt-4o-mini" };
  if (preferred === "anthropic" && env.anthropicKey) return { provider: "anthropic", model: env.aiModel || "claude-opus-5" };
  if (preferred === "openai" && env.openaiKey) return { provider: "openai", model: env.aiModel || "gpt-4o-mini" };
  return null;
}

export function isAiConfigured() {
  return resolveProvider() !== null;
}

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

export async function generateJson<T extends z.ZodTypeAny>(opts: {
  system: string;
  user: string;
  schema: T;
  schemaName: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}): Promise<{ data: z.infer<T>; model: string }> {
  const target = resolveProvider();
  if (!target) throw new Error("No AI provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)");
  const maxTokens = opts.maxTokens ?? 4000;

  if (target.provider === "anthropic") {
    anthropic ??= new Anthropic({ apiKey: env.anthropicKey, maxRetries: 2, timeout: 120_000 });
    const response = await anthropic.messages.parse({
      model: target.model,
      max_tokens: maxTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.user }],
      output_config: { format: zodOutputFormat(opts.schema), effort: opts.effort ?? "low" },
    });
    if (response.stop_reason === "refusal") throw new Error("The model declined this request");
    if (!response.parsed_output) throw new Error("Model returned no parseable output");
    return { data: opts.schema.parse(response.parsed_output), model: target.model };
  }

  openai ??= new OpenAI({ apiKey: env.openaiKey, maxRetries: 2, timeout: 120_000 });
  const { toJSONSchema } = await import("zod");
  const jsonSchema = toJSONSchema(opts.schema) as Record<string, unknown>;
  const completion = await openai.chat.completions.create({
    model: target.model,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_schema", json_schema: { name: opts.schemaName, schema: jsonSchema, strict: false } },
  });
  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("Model returned no output");
  return { data: opts.schema.parse(JSON.parse(text)), model: target.model };
}
