import { cn } from "@/lib/utils";
import { opportunityTone, scoreTone } from "@/lib/format";

/* Score colours use the tint palette as translucent backgrounds so meaning
   stays readable while the UI keeps one accent colour. */
const SCORE_PILL = {
  none: "bg-foreground/6 text-muted-foreground",
  bad: "bg-destructive/12 text-[#9b2c30]",
  poor: "bg-tint-orange/22 text-[#8a3d12]",
  ok: "bg-tint-yellow/30 text-[#6d5100]",
  good: "bg-tint-green/28 text-[#1b6a3a]",
};
const BAR = {
  none: "bg-foreground/20",
  bad: "bg-destructive",
  poor: "bg-tint-orange",
  ok: "bg-tint-yellow",
  good: "bg-tint-green",
};
const RING = { none: "#c9c1b7", bad: "#e5484d", poor: "#ff864a", ok: "#fcc934", good: "#48f08b" };
const OPP_PILL = {
  none: "bg-foreground/6 text-muted-foreground",
  low: "bg-foreground/6 text-muted-foreground",
  mid: "bg-tint-blue/14 text-[#1f4f9a]",
  high: "bg-tint-blue/28 text-[#153a75]",
  hot: "bg-primary text-primary-foreground",
};

export function ScoreBadge({ score, className, title }: { score: number | null | undefined; className?: string; title?: string }) {
  const tone = scoreTone(score);
  return (
    <span title={title} className={cn("inline-flex h-6 min-w-[36px] items-center justify-center rounded-full px-2 font-mono text-[12px] font-medium tabular-nums", SCORE_PILL[tone], className)}>
      {score == null ? "—" : score}
    </span>
  );
}

export function OpportunityBadge({ score, className }: { score: number | null | undefined; className?: string }) {
  const tone = opportunityTone(score);
  return (
    <span className={cn("inline-flex h-6 min-w-[36px] items-center justify-center gap-1 rounded-full px-2 font-mono text-[12px] font-medium tabular-nums", OPP_PILL[tone], className)}>
      {tone === "hot" && <span aria-hidden="true">🔥</span>}
      {score == null ? "—" : score}
    </span>
  );
}

export function ScoreBar({ label, score, hint, size = "md" }: { label: string; score: number | null | undefined; hint?: string; size?: "sm" | "md" }) {
  const tone = scoreTone(score);
  return (
    <div className={cn("space-y-1.5", size === "sm" && "space-y-1")}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn("text-[13px] font-medium", size === "sm" && "text-[12px]")}>{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {score == null ? "n/a" : score}
          {hint && <span className="ml-1.5 text-[10px] uppercase tracking-wider">{hint}</span>}
        </span>
      </div>
      <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-foreground/8", size === "sm" && "h-1")}>
        <div className={cn("h-full rounded-full transition-[width] duration-700 ease-(--ease-spring)", BAR[tone])} style={{ width: `${score ?? 0}%` }} />
      </div>
    </div>
  );
}

export function ScoreRing({ score, size = 76, label }: { score: number | null | undefined; size?: number; label?: string }) {
  const tone = scoreTone(score);
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score ?? 0;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={label ? `${label}: ${score ?? "n/a"}` : undefined}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" className="text-foreground/8" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={RING[tone]} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} style={{ transition: "stroke-dashoffset .7s var(--ease-spring)" }} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="rotate-90 fill-foreground font-medium" style={{ transformOrigin: "center", fontSize: size / 3.4, fontFamily: "var(--font-mono)" }}>
          {score == null ? "—" : score}
        </text>
      </svg>
      {label && <span className="eyebrow">{label}</span>}
    </div>
  );
}
