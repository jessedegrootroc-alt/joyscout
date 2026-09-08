"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ScanRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(status === "RUNNING" || status === "QUEUED") && (
          <DropdownMenuItem
            onClick={async () => {
              await fetch(`/api/scans/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
              toast.success("Scan cancelled");
              router.refresh();
            }}
          >
            <XCircle className="size-4" /> Cancel scan
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          onClick={async () => {
            if (!confirm("Delete this scan? Prospects stay in your database.")) return;
            await fetch(`/api/scans/${id}`, { method: "DELETE" });
            toast.success("Scan deleted");
            router.refresh();
          }}
        >
          <Trash2 className="size-4" /> Delete scan
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
