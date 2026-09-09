"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, ListPlus, Trash2, Search, ScanSearch, MessageSquareText, StickyNote, Tag, PhoneOutgoing, CalendarPlus, Download, ListMinus, Sparkles, Plus, Check } from "lucide-react";
import type { ProspectDTO } from "./types";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtDate } from "@/lib/format";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DISCOVERED: Search,
  ANALYZED: ScanSearch,
  STATUS_CHANGED: Tag,
  NOTE_ADDED: StickyNote,
  OUTREACH_GENERATED: MessageSquareText,
  FOLLOW_UP_GENERATED: Sparkles,
  FOLLOW_UP_SCHEDULED: CalendarPlus,
  CONTACTED: PhoneOutgoing,
  LIST_ADDED: ListPlus,
  LIST_REMOVED: ListMinus,
  EXPORTED: Download,
};

export function CrmPanel({ p, lists, onChange }: { p: ProspectDTO; lists: { id: string; name: string }[]; onChange: (patch: Partial<ProspectDTO>) => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Lists can be created right here, so keep a local copy that we can extend
  // before the server component re-renders with the fresh list.
  const [createdLists, setCreatedLists] = useState<{ id: string; name: string }[]>([]);
  const allLists = useMemo(() => [...lists, ...createdLists.filter((c) => !lists.some((l) => l.id === c.id))], [lists, createdLists]);
  const [listOpen, setListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  async function createListAndAdd() {
    const name = newListName.trim();
    if (!name) return;
    setCreatingList(true);
    try {
      const res = await fetch("/api/lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Could not create list");
        return;
      }
      setCreatedLists((cur) => [...cur, { id: data.id, name: data.name }]);
      setNewListName("");
      setListOpen(false);
      await bulk("add_to_list", { listId: data.id });
      toast.success(`List “${data.name}” created`);
    } finally {
      setCreatingList(false);
    }
  }

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/prospects/${p.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      toast.error("Update failed");
      return;
    }
    const data = await res.json();
    onChange({ status: data.status, followUpAt: data.followUpAt, contactedAt: data.contactedAt });
    router.refresh();
  }

  async function addNote() {
    if (!note.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/prospects/${p.id}/notes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: note.trim() }) });
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save note");
      return;
    }
    setNote("");
    toast.success("Note added");
    router.refresh();
  }

  async function bulk(action: string, payload: Record<string, unknown>) {
    const res = await fetch("/api/prospects/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ids: [p.id], ...payload }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) toast.error(d.error ?? "Failed");
    else toast.success(d.message ?? "Done");
    router.refresh();
  }

  const followUpValue = p.followUpAt ? new Date(p.followUpAt).toISOString().slice(0, 10) : "";
  const contactedValue = p.contactedAt ? new Date(p.contactedAt).toISOString().slice(0, 10) : "";

  return (
    <aside className="space-y-5">
      <section className="surface p-5">
        <h2 className="mb-4 text-[15px] font-medium">Lead management</h2>
        <div className="space-y-4 text-[13.5px]">
          <label className="block space-y-1">
            <span className="eyebrow">Status</span>
            <Select value={p.status} onValueChange={(v) => patch({ status: v })}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-1">
            <span className="eyebrow">Contacted on</span>
            <Input type="date" className="h-9" value={contactedValue} onChange={(e) => patch({ contactedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          </label>
          <label className="block space-y-1">
            <span className="eyebrow">Follow-up date</span>
            <div className="flex gap-1.5">
              <Input type="date" className="h-9" value={followUpValue} onChange={(e) => patch({ followUpAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              <Button variant="outline" size="sm" className="h-9 px-3 font-mono text-[12px]" title="In 3 days" onClick={() => patch({ followUpAt: new Date(Date.now() + 3 * 86400000).toISOString() })}>
                +3d
              </Button>
              <Button variant="outline" size="sm" className="h-9 px-3 font-mono text-[12px]" title="In 7 days" onClick={() => patch({ followUpAt: new Date(Date.now() + 7 * 86400000).toISOString() })}>
                +7d
              </Button>
            </div>
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {p.status !== "CONTACTED" && (
              <Button size="sm" variant="outline" onClick={() => patch({ status: "CONTACTED" })}>
                <PhoneOutgoing className="size-3.5" /> Mark contacted
              </Button>
            )}
            <Popover open={listOpen} onOpenChange={setListOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline">
                  <ListPlus className="size-3.5" /> Add to list
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="w-72 gap-0 p-0">
                {allLists.length > 0 ? (
                  <ul className="max-h-56 overflow-y-auto p-1.5">
                    {allLists.map((l) => {
                      const inList = p.lists.some((x) => x.list.id === l.id);
                      return (
                        <li key={l.id}>
                          <button
                            type="button"
                            disabled={inList}
                            onClick={async () => {
                              setListOpen(false);
                              await bulk("add_to_list", { listId: l.id });
                            }}
                            className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13.5px] transition-colors hover:bg-surface-hover disabled:cursor-default disabled:text-muted-foreground disabled:hover:bg-transparent"
                          >
                            <span className="truncate">{l.name}</span>
                            {inList && <Check className="size-3.5 shrink-0" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-3.5 pt-3 text-[12.5px] text-muted-foreground">No lists yet. Create your first one below.</p>
                )}
                <form
                  className="flex items-center gap-1.5 border-t border-border p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void createListAndAdd();
                  }}
                >
                  <Input
                    autoFocus={allLists.length === 0}
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void createListAndAdd();
                      }
                    }}
                    placeholder="New list, e.g. “Bellen deze week”"
                    maxLength={80}
                    className="h-9 flex-1 rounded-xl text-[13px]"
                  />
                  <Button type="submit" size="sm" className="h-9 shrink-0 gap-1 px-3" disabled={creatingList || !newListName.trim()} title="Create list and add this prospect">
                    <Plus className="size-3.5" /> {creatingList ? "Creating…" : "Create"}
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
          </div>
          {p.lists.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {p.lists.map((l) => (
                <span key={l.list.id} className="inline-flex items-center gap-1.5 rounded-full border border-input px-2.5 py-0.5 text-[12px]">
                  {l.list.name}
                  <button className="text-muted-foreground hover:text-foreground" title="Remove from list" onClick={() => bulk("remove_from_list", { listId: l.list.id })}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="surface p-5">
        <h2 className="mb-3 text-[15px] font-medium">Notes</h2>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Called 8 Sep. Owner asked to call back Thursday." className="min-h-[80px] text-[13.5px]" />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={addNote} disabled={saving || !note.trim()}>
            Add note
          </Button>
        </div>
        {p.notes.length > 0 && (
          <ul className="mt-4 space-y-2">
            {p.notes.map((n) => (
              <li key={n.id} className="group rounded-2xl bg-background px-4 py-3 text-[13.5px] leading-relaxed">
                <div className="whitespace-pre-wrap">{n.body}</div>
                <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                  {fmtDate(n.createdAt, true)}
                  <button
                    className="opacity-0 transition group-hover:opacity-100"
                    onClick={async () => {
                      await fetch(`/api/prospects/${p.id}/notes?noteId=${n.id}`, { method: "DELETE" });
                      router.refresh();
                    }}
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="surface p-5">
        <h2 className="mb-4 inline-flex items-center gap-2 text-[15px] font-medium">
          <CalendarClock className="size-4" /> Activity
        </h2>
        <ol className="relative space-y-4 border-l border-border pl-5">
          {p.activities.map((a) => {
            const Icon = ICONS[a.type] ?? Tag;
            return (
              <li key={a.id} className="relative text-[13.5px]">
                <span className="absolute -left-[29px] top-0 flex size-[18px] items-center justify-center rounded-full border border-border bg-card">
                  <Icon className="size-2.5 text-muted-foreground" />
                </span>
                <div className="font-mono text-[11px] text-muted-foreground">{fmtDate(a.createdAt, true)}</div>
                <div>{a.message}</div>
              </li>
            );
          })}
          {p.activities.length === 0 && <li className="text-[13px] text-muted-foreground">No activity yet.</li>}
        </ol>
      </section>
    </aside>
  );
}
