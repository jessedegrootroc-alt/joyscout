"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, CalendarPlus, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FollowUpActions({ prospectId, suggested, hasFollowUps }: { prospectId: string; suggested: { index: number; text: string } | null; hasFollowUps: boolean }) {
  const router = useRouter();
  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/prospects/${prospectId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return toast.error("Update failed");
    router.refresh();
  }
  return (
    <div className="flex items-center gap-1">
      {suggested ? (
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={async () => {
            await navigator.clipboard.writeText(suggested.text);
            toast.success(`Follow-up ${suggested.index} copied`);
          }}
        >
          <Copy className="size-3.5" /> Copy follow-up {suggested.index}
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href={`/follow-ups/${prospectId}`}>
            <MessageSquareText className="size-3.5" /> {hasFollowUps ? "Open follow-up" : "Open follow-up message"}
          </Link>
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-8" title="Done: mark contacted, schedule next in 7 days" onClick={() => patch({ status: "FOLLOW_UP", contactedAt: new Date().toISOString(), followUpAt: new Date(Date.now() + 7 * 86400000).toISOString() })}>
        <CalendarPlus className="size-3.5" /> Sent, +7d
      </Button>
      <Button variant="ghost" size="sm" className="h-8" title="Clear follow-up" onClick={() => patch({ followUpAt: null })}>
        <Check className="size-3.5" />
      </Button>
    </div>
  );
}
