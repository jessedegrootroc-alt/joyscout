"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const go = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    next.set("page", String(p));
    router.push(`${pathname}?${next.toString()}`);
  };
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-muted-foreground">
      <span className="eyebrow">
        Page {page} of {pages}
      </span>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
        Previous
      </Button>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => go(page + 1)}>
        Next
      </Button>
    </div>
  );
}
