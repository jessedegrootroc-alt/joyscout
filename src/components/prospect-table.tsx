"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, Globe, Loader2, MoreHorizontal, Star, Mail, Phone, ImageOff } from "lucide-react";
import { toast } from "sonner";
import type { ProspectRowDTO } from "@/server/prospects/query";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OpportunityBadge, ScoreBadge } from "@/components/score";
import { PriorityLabel, StatusBadge } from "@/components/status-badge";
import { BulkActionsBar } from "@/components/bulk-actions-bar";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProspectTable({
  rows,
  lists,
  total,
  live = false,
  compact = false,
  emptyMessage,
}: {
  rows: ProspectRowDTO[];
  lists: { id: string; name: string }[];
  total: number;
  live?: boolean;
  compact?: boolean;
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const columns = useMemo<ColumnDef<ProspectRowDTO>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(Boolean(v))} aria-label="Select row" onClick={(e) => e.stopPropagation()} />
        ),
        size: 36,
        enableSorting: false,
      },
      {
        id: "company",
        accessorKey: "name",
        header: "Company",
        cell: ({ row }) => {
          const p = row.original;
          return (
            <div className="min-w-[220px] max-w-[300px]">
              <Link href={`/prospects/${p.id}`} className="block truncate text-[14px] font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                {p.name}
              </Link>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {p.priorityLabels.slice(0, 2).map((l) => (
                  <PriorityLabel key={l} label={l} />
                ))}
                {p.analysisStatus === "ANALYZING" || p.analysisStatus === "PENDING" ? (
                  <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-foreground/6 px-2 text-[11px] text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> {p.analysisStatus === "ANALYZING" ? "Analysing" : "Queued"}
                  </span>
                ) : p.analysisStatus === "FAILED" ? (
                  <span className="inline-flex h-[22px] items-center rounded-full bg-destructive/10 px-2 text-[11px] text-destructive" title={p.analysisError ?? undefined}>
                    Analysis failed
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "screenshot",
        header: "Preview",
        enableSorting: false,
        cell: ({ row }) => {
          const p = row.original;
          return p.screenshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.screenshot} alt="" width={96} height={60} loading="lazy" className="h-[60px] w-[96px] rounded-xl border border-border object-cover object-top" />
          ) : (
            <div className="flex h-[60px] w-[96px] items-center justify-center rounded-xl border border-dashed border-input text-muted-foreground/60">
              <ImageOff className="size-4" />
            </div>
          );
        },
      },
      {
        id: "website",
        accessorKey: "domain",
        header: "Website",
        cell: ({ row }) => {
          const p = row.original;
          if (!p.hasWebsite || !p.website) {
            if (p.socialOnly)
              return (
                <a href={p.socialOnly.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-tint-pink/30 px-2 py-0.5 text-[11.5px] font-medium text-[#8a2a5c] hover:underline" onClick={(e) => e.stopPropagation()} title="No website — only a social page">
                  Only {p.socialOnly.network.charAt(0).toUpperCase() + p.socialOnly.network.slice(1)}
                </a>
              );
            return <span className="text-[12.5px] italic text-muted-foreground">No website found</span>;
          }
          return (
            <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex max-w-[180px] items-center gap-1 truncate text-xs hover:underline" onClick={(e) => e.stopPropagation()}>
              <Globe className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{p.domain}</span>
            </a>
          );
        },
      },
      {
        id: "location",
        accessorKey: "city",
        header: "Location",
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs">
            {row.original.city ?? "—"}
            {row.original.countryCode ? <span className="text-muted-foreground">, {row.original.countryCode}</span> : null}
          </span>
        ),
      },
      { id: "industry", accessorKey: "industry", header: "Industry", cell: ({ getValue }) => <span className="whitespace-nowrap text-xs text-muted-foreground">{String(getValue())}</span> },
      {
        id: "rating",
        accessorKey: "googleRating",
        header: "Rating",
        cell: ({ row }) =>
          row.original.googleRating != null ? (
            <span className="inline-flex items-center gap-1 text-xs tabular-nums">
              <Star className="size-3 fill-tint-yellow text-tint-yellow" /> {row.original.googleRating.toFixed(1)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        id: "reviews",
        accessorKey: "googleReviewCount",
        header: "Reviews",
        cell: ({ getValue }) => <span className="text-xs tabular-nums">{(getValue() as number | null) ?? "—"}</span>,
      },
      { id: "websiteScore", accessorKey: "websiteScore", header: "Website", cell: ({ row }) => (row.original.hasWebsite ? <ScoreBadge score={row.original.websiteScore} /> : <span className="text-xs text-muted-foreground">n/a</span>) },
      { id: "seoScore", accessorKey: "seoScore", header: "SEO", cell: ({ row }) => (row.original.hasWebsite ? <ScoreBadge score={row.original.seoScore} /> : <span className="text-xs text-muted-foreground">n/a</span>) },
      { id: "opportunityScore", accessorKey: "opportunityScore", header: "Opportunity", cell: ({ getValue }) => <OpportunityBadge score={getValue() as number | null} /> },
      { id: "platform", accessorKey: "platform", header: "Platform", cell: ({ getValue }) => <span className="whitespace-nowrap text-xs text-muted-foreground">{(getValue() as string | null) ?? "—"}</span> },
      {
        id: "email",
        accessorKey: "email",
        header: "Email",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? (
            <a href={`mailto:${v}`} className="inline-flex max-w-[180px] items-center gap-1 truncate text-xs hover:underline" onClick={(e) => e.stopPropagation()}>
              <Mail className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{v}</span>
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
      {
        id: "phone",
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? (
            <a href={`tel:${v}`} className="inline-flex items-center gap-1 whitespace-nowrap text-xs hover:underline" onClick={(e) => e.stopPropagation()}>
              <Phone className="size-3 text-muted-foreground" /> {v}
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          );
        },
      },
      { id: "status", accessorKey: "status", header: "Status", cell: ({ getValue }) => <StatusBadge status={String(getValue())} /> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => <RowActions p={row.original} lists={lists} />,
        size: 40,
      },
    ],
    [lists],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  return (
    <div className="relative">
      <div className="scroll-thin overflow-x-auto rounded-[1.25rem] border border-border bg-card">
        <table className="data-table w-full min-w-[1400px] text-[13.5px]">
          <thead className="text-left">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className={cn("border-b border-border px-3 py-3 first:pl-5 last:pr-5", h.column.getCanSort() && "cursor-pointer select-none hover:text-foreground")} onClick={h.column.getToggleSortingHandler()} style={{ width: h.getSize() !== 150 ? h.getSize() : undefined }}>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getCanSort() && h.id !== "select" && <ArrowUpDown className={cn("size-3 opacity-0", h.column.getIsSorted() && "opacity-100")} />}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center text-[14px] text-muted-foreground">
                  {live ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Waiting for the first results…
                    </span>
                  ) : (
                    emptyMessage ?? "No prospects match these filters."
                  )}
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={cn("cursor-pointer", row.getIsSelected() && "bg-tint-blue/8 hover:bg-tint-blue/10!", compact && "text-xs")} onClick={() => router.push(`/prospects/${row.original.id}`)}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 align-middle first:pl-5 last:pr-5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {rows.length} of {total} prospects
      </div>
      {selectedIds.length > 0 && (
        <BulkActionsBar
          ids={selectedIds}
          lists={lists}
          onDone={() => {
            setRowSelection({});
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function RowActions({ p, lists }: { p: ProspectRowDTO; lists: { id: string; name: string }[] }) {
  const router = useRouter();
  async function bulk(action: string, payload?: Record<string, unknown>) {
    const res = await fetch("/api/prospects/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ids: [p.id], ...payload }),
    });
    if (!res.ok) {
      toast.error("Action failed");
      return;
    }
    toast.success("Updated");
    router.refresh();
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link href={`/prospects/${p.id}`}>
            <ExternalLink className="size-4" /> Open details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/prospects/${p.id}?tab=outreach`}>Generate outreach</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => bulk("mark_contacted")}>Mark as contacted</DropdownMenuItem>
        {LEAD_STATUSES.filter((s) => s !== p.status).slice(0, 4).map((s) => (
          <DropdownMenuItem key={s} onClick={() => bulk("set_status", { status: s })}>
            Set status: {LEAD_STATUS_LABEL[s]}
          </DropdownMenuItem>
        ))}
        {lists.length > 0 && <DropdownMenuSeparator />}
        {lists.slice(0, 5).map((l) => (
          <DropdownMenuItem key={l.id} onClick={() => bulk("add_to_list", { listId: l.id })}>
            Add to “{l.name}”
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (confirm(`Delete ${p.name}?`)) bulk("delete");
          }}
        >
          Delete prospect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
