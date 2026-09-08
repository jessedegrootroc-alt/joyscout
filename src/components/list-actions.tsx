"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function NewListButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  async function create() {
    const res = await fetch("/api/lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description: description || undefined }) });
    const d = await res.json();
    if (!res.ok) return toast.error(d.error ?? "Could not create list");
    setOpen(false);
    setName("");
    setDescription("");
    toast.success("List created");
    router.refresh();
  }
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" /> New list
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New list</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website redesign leads" onKeyDown={(e) => e.key === "Enter" && name.trim() && create()} />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What goes in this list?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ListActions({ id, name, description, locked, redirectOnDelete }: { id: string; name: string; description: string | null; locked?: boolean; redirectOnDelete?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(name);
  const [d, setD] = useState(description ?? "");
  async function save() {
    const res = await fetch(`/api/lists/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n, description: d || null }) });
    if (!res.ok) return toast.error("Could not update list");
    setOpen(false);
    toast.success("List updated");
    router.refresh();
  }
  async function remove() {
    if (!confirm(`Delete list “${name}”? Prospects are not deleted.`)) return;
    const res = await fetch(`/api/lists/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error ?? "Could not delete list");
    toast.success("List deleted");
    if (redirectOnDelete) router.push("/lists");
    router.refresh();
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Pencil className="size-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={locked} onClick={remove}>
            <Trash2 className="size-4" /> {locked ? "Delete (used by radar)" : "Delete list"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit list</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={n} onChange={(e) => setN(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={d} onChange={(e) => setD(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!n.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
