"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Loader2, Sparkles, Trash2, CalendarPlus } from "lucide-react";
import type { ProspectDTO } from "./types";
import { OUTREACH_CHANNELS, OUTREACH_LENGTHS, OUTREACH_TONES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", LINKEDIN: "LinkedIn", WHATSAPP: "WhatsApp", PHONE: "Phone opening", INSTAGRAM: "Instagram DM" };

type Outreach = ProspectDTO["outreach"][number];

export function OutreachPanel({ p, aiConfigured, defaultLanguage, onChange }: { p: ProspectDTO; aiConfigured: boolean; defaultLanguage: string; onChange: (outreach: Outreach[]) => void }) {
  const router = useRouter();
  const [channel, setChannel] = useState<(typeof OUTREACH_CHANNELS)[number]>("EMAIL");
  const [tone, setTone] = useState<(typeof OUTREACH_TONES)[number]>("friendly");
  const [length, setLength] = useState<(typeof OUTREACH_LENGTHS)[number]>("medium");
  const [language, setLanguage] = useState(defaultLanguage);
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const roots = p.outreach.filter((o) => !o.isFollowUp);
  const followUpsOf = (id: string) => p.outreach.filter((o) => o.parentId === id).sort((a, b) => (a.followUpIndex ?? 0) - (b.followUpIndex ?? 0));

  async function generate() {
    setBusy("generate");
    try {
      const res = await fetch(`/api/prospects/${p.id}/outreach`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel, tone, length, language, extraContext: extra || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      onChange([...p.outreach, data]);
      toast.success("Outreach generated");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function followUps(id: string) {
    setBusy(`fu:${id}`);
    try {
      const res = await fetch(`/api/outreach/${id}/follow-ups`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      onChange([...p.outreach, ...data]);
      toast.success("3 follow-ups generated");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/outreach/${id}`, { method: "DELETE" });
    onChange(p.outreach.filter((o) => o.id !== id && o.parentId !== id));
    router.refresh();
  }

  function copy(o: Outreach) {
    const text = o.subject ? `Subject: ${o.subject}\n\n${o.body}` : o.body;
    navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"));
  }

  async function markContacted() {
    await fetch(`/api/prospects/${p.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "CONTACTED", contactedAt: new Date().toISOString() }) });
    toast.success("Marked as contacted");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <section className="surface p-5 md:p-6">
        <h2 className="mb-1 inline-flex items-center gap-2 text-[17px] font-medium tracking-tight">
          <Sparkles className="size-4" /> Generate outreach
        </h2>
        <p className="mb-4 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">Messages are written from the audit findings: rating, reviews, concrete website problems and the recommended service. Nothing generic.</p>
        {!aiConfigured && <p className="mb-4 rounded-2xl bg-tint-yellow/20 px-4 py-3 text-[13px] leading-relaxed">AI is not configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to .env and restart to enable outreach generation.</p>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Channel">
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTREACH_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CHANNEL_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tone">
            <Select value={tone} onValueChange={(v) => setTone(v as typeof tone)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTREACH_TONES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Length">
            <Select value={length} onValueChange={(v) => setLength(v as typeof length)}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTREACH_LENGTHS.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Language">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="nl">Dutch</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Optional extra context, e.g. “mention we redesigned a roofer in Utrecht last month”" className="mt-4 min-h-[60px] text-[13.5px]" />
        <div className="mt-4 flex justify-end">
          <Button onClick={generate} disabled={!aiConfigured || busy === "generate"}>
            {busy === "generate" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Generate {CHANNEL_LABEL[channel].toLowerCase()}
          </Button>
        </div>
      </section>

      {roots.length === 0 ? (
        <p className="surface px-5 py-10 text-center text-[14px] text-muted-foreground">No outreach generated yet.</p>
      ) : (
        [...roots].reverse().map((o) => (
          <section key={o.id} className="surface overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
              <div className="text-[13.5px]">
                <span className="font-medium">{CHANNEL_LABEL[o.channel]}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {o.tone} · {o.length} · {fmtDate(o.createdAt, true)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => copy(o)}>
                  <Copy className="size-3.5" /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={markContacted}>
                  <CalendarPlus className="size-3.5" /> Mark contacted
                </Button>
                {followUpsOf(o.id).length === 0 && (
                  <Button variant="ghost" size="sm" disabled={busy === `fu:${o.id}` || !aiConfigured} onClick={() => followUps(o.id)}>
                    {busy === `fu:${o.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Generate follow-ups
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => remove(o.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </header>
            <div className="px-5 py-4 text-[14px]">
              {o.subject && (
                <div className="mb-3">
                  <span className="eyebrow mr-2">Subject</span>
                  <span className="font-medium">{o.subject}</span>
                </div>
              )}
              <pre className="whitespace-pre-wrap font-sans leading-relaxed">{o.body}</pre>
            </div>
            {followUpsOf(o.id).length > 0 && (
              <div className="border-t border-border bg-background px-5 py-4">
                <div className="eyebrow mb-3">Follow-up sequence</div>
                <div className="grid gap-3 md:grid-cols-3">
                  {followUpsOf(o.id).map((f) => (
                    <div key={f.id} className={cn("rounded-2xl border border-border bg-card p-4 text-[13.5px]")}>
                      <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                        <span>
                          Follow-up {f.followUpIndex} · after {f.followUpAfterDays} days
                        </span>
                        <button onClick={() => copy(f)} className="hover:text-foreground">
                          <Copy className="size-3" />
                        </button>
                      </div>
                      {f.subject && <div className="mb-1 font-medium">{f.subject}</div>}
                      <pre className="whitespace-pre-wrap font-sans leading-relaxed">{f.body}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
