"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Play, Trash2, Pencil, History } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SavedSearchActions({ id, lastScanId }: { id: string; lastScanId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center justify-end gap-1">
      {lastScanId && (
        <Button asChild variant="ghost" size="sm" className="h-8">
          <Link href={`/scans/${lastScanId}`}>
            <History className="size-3.5" /> Last results
          </Link>
        </Button>
      )}
      <Button asChild variant="ghost" size="sm" className="h-8">
        <Link href={`/find?saved=${id}`}>
          <Pencil className="size-3.5" /> Edit & run
        </Link>
      </Button>
      <Button
        size="sm"
        className="h-8"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch(`/api/saved-searches/${id}`, { method: "POST" });
          setBusy(false);
          const d = await res.json().catch(() => ({}));
          if (!res.ok) return toast.error(d.error ?? "Could not run search");
          router.push(`/scans/${d.id}`);
        }}
      >
        <Play className="size-3.5" /> Run again
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        onClick={async () => {
          if (!confirm("Delete this saved search?")) return;
          await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
          router.refresh();
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
