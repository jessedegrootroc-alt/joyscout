import { cn } from "@/lib/utils";

/** Joyscrape wordmark: a warm circular lens mark + medium-weight wordmark. */
export function Logo({ className, compact = false, size = "md" }: { className?: string; compact?: boolean; size?: "md" | "lg" }) {
  const mark = size === "lg" ? "size-9" : "size-7";
  return (
    <div className={cn("flex items-center gap-2.5 font-medium tracking-tight", className)}>
      <span className={cn("relative flex items-center justify-center rounded-full bg-primary text-primary-foreground", mark)}>
        <svg viewBox="0 0 24 24" className={size === "lg" ? "size-4.5" : "size-3.5"} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.2-4.2" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-brand" aria-hidden="true" />
      </span>
      {!compact && <span className={size === "lg" ? "text-[22px]" : "text-[17px]"}>Joyscrape</span>}
    </div>
  );
}
