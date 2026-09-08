import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABEL, type LeadStatusKey } from "@/lib/types";

/* Lead statuses stay mostly neutral; only outcome-defining states get a tint. */
const STATUS_STYLES: Record<LeadStatusKey, string> = {
  NEW: "bg-foreground/6 text-foreground/80",
  QUALIFIED: "bg-tint-blue/14 text-[#1f4f9a]",
  CONTACTED: "bg-tint-blue/24 text-[#153a75]",
  REPLIED: "bg-tint-green/28 text-[#1b6a3a]",
  FOLLOW_UP: "bg-tint-orange/22 text-[#8a3d12]",
  MEETING_BOOKED: "bg-tint-yellow/32 text-[#6d5100]",
  WON: "bg-primary text-primary-foreground",
  LOST: "bg-foreground/6 text-muted-foreground line-through decoration-foreground/30",
  NOT_INTERESTED: "bg-foreground/6 text-muted-foreground",
};

const PILL = "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status as LeadStatusKey;
  return <span className={cn(PILL, STATUS_STYLES[key] ?? "bg-foreground/6", className)}>{LEAD_STATUS_LABEL[key] ?? status}</span>;
}

const LABEL_STYLES: Record<string, string> = {
  "Hot Lead": "bg-primary text-primary-foreground",
  "High Opportunity": "bg-tint-blue/22 text-[#153a75]",
  "Good Business / Bad Website": "bg-tint-yellow/32 text-[#6d5100]",
  "SEO Opportunity": "border border-input text-foreground/80",
  "No Website": "bg-tint-orange/22 text-[#8a3d12]",
  "Needs Redesign": "bg-tint-pink/45 text-[#7a2a6c]",
  "Low Priority": "bg-foreground/6 text-muted-foreground",
};

export function PriorityLabel({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn(PILL, "h-[22px] text-[11px]", LABEL_STYLES[label] ?? "bg-foreground/6", className)}>
      {label === "Hot Lead" ? "🔥 Hot lead" : label}
    </span>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  google_business: "Google Business",
  website: "Website",
  pagespeed: "PageSpeed",
  derived: "Derived",
  ai: "AI observation",
  osm: "OpenStreetMap",
};

/** Provenance tag: verified sources are neutral, derived/AI are visibly different. */
export function SourceTag({ source }: { source: string }) {
  const derived = source === "derived";
  const ai = source === "ai";
  return (
    <span className={cn("inline-flex h-[18px] items-center rounded-full border px-1.5 font-mono text-[9.5px] font-medium uppercase tracking-wider", ai ? "border-tint-pink bg-tint-pink/30 text-[#7a2a6c]" : derived ? "border-dashed border-input text-muted-foreground" : "border-input text-muted-foreground")}>
      {SOURCE_LABEL[source] ?? source}
    </span>
  );
}
