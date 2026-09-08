import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-background px-5 py-16 text-center">
      <Logo size="lg" className="mb-10" />
      <p className="eyebrow mb-3">Error 404</p>
      <h1 className="display text-[2.25rem] md:text-[3rem]">This page went missing.</h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">The link may be outdated or the item was deleted. Your prospects are still where you left them.</p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/">Back to dashboard</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/prospects">Open prospects</Link>
        </Button>
      </div>
    </div>
  );
}
