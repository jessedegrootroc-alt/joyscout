"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <p className="eyebrow mb-3">Something broke</p>
      <h1 className="display text-[2rem] md:text-[2.5rem]">This page hit an error.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">Nothing was lost. Try again, or head back to the dashboard while we recover.</p>
      {error.digest && <p className="mt-3 font-mono text-[11px] text-muted-foreground">ref {error.digest}</p>}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
