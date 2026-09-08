"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Building2, Globe, Mail, MapPin } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

type Hit = {
  id: string;
  name: string;
  domain: string | null;
  email: string | null;
  city: string | null;
  industry: string;
  opportunityScore: number | null;
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setHits(await res.json());
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  const visible = q.trim().length >= 2 ? hits : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-[340px] items-center gap-2.5 rounded-full border border-input bg-card pl-3.5 pr-2 text-[13.5px] text-muted-foreground transition-colors hover:bg-surface-hover focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">Search prospects…</span>
        <kbd className="hidden rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search prospects" description="Search by company, website, email, city or industry">
        <Command shouldFilter={false}>
        <CommandInput placeholder="Search prospects by name, website, email, city or industry…" value={q} onValueChange={setQ} />
        <CommandList>
          {q.trim().length >= 2 && !loading && visible.length === 0 && <CommandEmpty>No prospects found.</CommandEmpty>}
          {q.trim().length < 2 && (
            <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">Type at least two characters to search by company, website, email, city or industry.</div>
          )}
          {visible.length > 0 && (
            <CommandGroup heading="Prospects">
              {visible.map((h) => (
                <CommandItem
                  key={h.id}
                  value={h.id}
                  onSelect={() => {
                    setOpen(false);
                    setQ("");
                    router.push(`/prospects/${h.id}`);
                  }}
                  className="flex items-center gap-3"
                >
                  <Building2 className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{h.name}</div>
                    <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {h.domain && (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="size-3" /> {h.domain}
                        </span>
                      )}
                      {h.email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="size-3" /> {h.email}
                        </span>
                      )}
                      {h.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" /> {h.city}
                        </span>
                      )}
                      <span>{h.industry}</span>
                    </div>
                  </div>
                  {h.opportunityScore != null && (
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">OPP {h.opportunityScore}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
