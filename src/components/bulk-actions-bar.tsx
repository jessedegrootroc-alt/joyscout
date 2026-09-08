"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListPlus, Tag, MessageSquareText, Download, Trash2, PhoneOutgoing, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/types";

export function BulkActionsBar({ ids, lists, onDone }: { ids: string[]; lists: { id: string; name: string }[]; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  async function run(action: string, payload?: Record<string, unknown>, successMsg?: string) {
    setBusy(action);
    try {
      const res = await fetch("/api/prospects/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ids, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast.success(successMsg ?? data.message ?? "Done");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function exportFile(format: "xlsx" | "csv") {
    setBusy("export");
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, format }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `joyscrape-prospects-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${ids.length} prospects as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function createListAndAdd() {
    if (!newListName.trim()) return;
    const res = await fetch("/api/lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newListName.trim() }) });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not create list");
      return;
    }
    setNewListOpen(false);
    setNewListName("");
    await run("add_to_list", { listId: data.id }, `Added ${ids.length} to “${data.name}”`);
    router.refresh();
  }

  return (
    <>
      <div className="page-enter fixed inset-x-0 bottom-6 z-40 mx-auto flex w-max max-w-[95vw] flex-wrap items-center justify-center gap-1 rounded-full border border-border bg-card p-1.5 shadow-panel">
        <span className="rounded-full bg-primary px-3 py-1.5 font-mono text-[11px] font-medium tabular-nums text-primary-foreground">{ids.length} selected</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={!!busy}>
              <ListPlus className="size-3.5" /> Add to list
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {lists.map((l) => (
              <DropdownMenuItem key={l.id} onClick={() => run("add_to_list", { listId: l.id }, `Added to “${l.name}”`)}>
                {l.name}
              </DropdownMenuItem>
            ))}
            {lists.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setNewListOpen(true)}>+ New list…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={!!busy}>
              <Tag className="size-3.5" /> Change status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {LEAD_STATUSES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => run("set_status", { status: s }, `Status set to ${LEAD_STATUS_LABEL[s]}`)}>
                {LEAD_STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => run("mark_contacted", {}, "Marked as contacted")}>
          <PhoneOutgoing className="size-3.5" /> Mark contacted
        </Button>
        <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => run("generate_outreach", { channel: "EMAIL" })}>
          {busy === "generate_outreach" ? <Loader2 className="size-3.5 animate-spin" /> : <MessageSquareText className="size-3.5" />} Generate outreach
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={!!busy}>
              {busy === "export" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />} Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => exportFile("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportFile("csv")}>CSV (.csv)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={!!busy}
          onClick={() => {
            if (confirm(`Delete ${ids.length} prospects? This cannot be undone.`)) run("delete", {}, "Deleted");
          }}
        >
          <Trash2 className="size-3.5" /> Delete
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDone} aria-label="Clear selection">
          <X className="size-3.5" />
        </Button>
      </div>

      <Dialog open={newListOpen} onOpenChange={setNewListOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New list</DialogTitle>
          </DialogHeader>
          <Input autoFocus placeholder="e.g. Amsterdam Roofers" value={newListName} onChange={(e) => setNewListName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createListAndAdd()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewListOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createListAndAdd}>Create & add {ids.length}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
