import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <p className="eyebrow mb-3">Error 404</p>
      <h1 className="display text-[2rem] md:text-[2.5rem]">We could not find that.</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">The prospect, scan or list you opened no longer exists, or it belongs to another account.</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/prospects">Open prospects</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/scans">View scrapes</Link>
        </Button>
      </div>
    </div>
  );
}
