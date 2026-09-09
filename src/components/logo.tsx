import { cn } from "@/lib/utils";
import { SmileyMark } from "./smiley-mark";

/**
 * Joyscrape wordmark: bold lowercase-feel sans, a blue smile tucked under the J
 * and an orange final "e". Built from text + inline SVG so it stays crisp at
 * every size and follows the app font. `compact` renders the smiley mark.
 */
export function Logo({ className, compact = false, size = "md" }: { className?: string; compact?: boolean; size?: "md" | "lg" }) {
  const px = size === "lg" ? 34 : 24;
  // Compact = the smiley favicon (mobile header); the wordmark keeps the J + smile.
  if (compact) return <SmileyMark className={cn("size-8", className)} />;
  return (
    <span
      className={cn("inline-flex items-baseline font-bold leading-none tracking-[-0.045em] text-[#1a1a1a] select-none", className)}
      style={{ fontSize: px }}
      aria-label="Joyscrape"
      role="img"
    >
      <span className="relative inline-block">
        J
        <svg
          viewBox="0 0 26 12"
          fill="none"
          aria-hidden="true"
          className="absolute left-[2%] top-[84%] w-[104%]"
          style={{ height: px * 0.3 }}
        >
          <path d="M2.2 2.4c4.3 6.2 17.3 6.2 21.6 0" stroke="#5E9BFF" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <>
          <span>oyscrap</span>
          <span className="text-[#FF864A]">e</span>
        </>
      )}
    </span>
  );
}
