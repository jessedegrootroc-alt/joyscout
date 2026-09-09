"use client";

import { useMemo, useState, type ComponentType } from "react";
import { Car, Check, ChevronDown, Fan, HardHat, House, KeyRound, PaintRoller, PersonStanding, Scale, Scissors, Search, Smile, SprayCan, Sun, TreeDeciduous, UtensilsCrossed, Wrench, Zap } from "lucide-react";
import { INDUSTRIES, type Industry } from "@/lib/industries";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Lang = "en" | "nl";
type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

const ICONS: Record<string, Icon> = {
  contractors: HardHat,
  roofers: House,
  painters: PaintRoller,
  electricians: Zap,
  plumbers: Wrench,
  installers: Fan,
  solar: Sun,
  landscapers: TreeDeciduous,
  dentists: Smile,
  physiotherapists: PersonStanding,
  "real-estate": KeyRound,
  lawyers: Scale,
  cleaning: SprayCan,
  "car-dealers": Car,
  restaurants: UtensilsCrossed,
  hairdressers: Scissors,
};

const GROUPS: { label: Record<Lang, string>; keys: string[] }[] = [
  { label: { nl: "Bouw & installatie", en: "Construction & trades" }, keys: ["contractors", "roofers", "painters", "electricians", "plumbers", "installers", "solar", "landscapers"] },
  { label: { nl: "Zorg & praktijken", en: "Health & practices" }, keys: ["dentists", "physiotherapists"] },
  { label: { nl: "Diensten & kantoor", en: "Services & offices" }, keys: ["real-estate", "lawyers", "cleaning", "car-dealers"] },
  { label: { nl: "Horeca & retail", en: "Hospitality & retail" }, keys: ["restaurants", "hairdressers"] },
];

const T = {
  placeholder: { nl: "Kies een branche…", en: "Choose an industry…" },
  search: { nl: "Zoek een branche of typ een eigen zoekterm…", en: "Search an industry or type your own term…" },
  custom: { nl: "Eigen zoekterm", en: "Custom search term" },
  useCustom: { nl: "Zoek op eigen term", en: "Search with this term" },
  hint: { nl: "Werkt ook, maar levert op OpenStreetMap minder bedrijven op dan een branche uit de lijst.", en: "Works too, but returns fewer businesses on OpenStreetMap than a listed industry." },
};

function IconTile({ icon: Ico, selected, className }: { icon: Icon; selected?: boolean; className?: string }) {
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-foreground/6 text-foreground transition-colors", selected && "bg-primary text-primary-foreground", className)}>
      <Ico className="size-[18px]" strokeWidth={1.9} />
    </span>
  );
}

export function IndustryPicker({
  lang,
  industryKey,
  customQuery,
  onChange,
}: {
  lang: Lang;
  industryKey: string | null;
  customQuery: string;
  onChange: (next: { industryKey: string | null; customQuery: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = industryKey ? INDUSTRIES.find((i) => i.key === industryKey) ?? null : null;
  const needle = q.trim().toLowerCase();

  const matches = (i: Industry) => !needle || i.label.nl.toLowerCase().includes(needle) || i.label.en.toLowerCase().includes(needle) || i.terms.nl.some((t) => t.includes(needle)) || i.terms.en.some((t) => t.includes(needle));
  const visibleGroups = useMemo(
    () => GROUPS.map((g) => ({ ...g, items: g.keys.map((k) => INDUSTRIES.find((i) => i.key === k)).filter((i): i is Industry => Boolean(i) && matches(i!)) })).filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [needle],
  );
  const exactMatch = INDUSTRIES.find((i) => i.label.nl.toLowerCase() === needle || i.label.en.toLowerCase() === needle);
  const showCustom = needle.length >= 2 && !exactMatch;

  const pick = (key: string) => {
    onChange({ industryKey: key, customQuery: "" });
    setQ("");
    setOpen(false);
  };
  const pickCustom = () => {
    onChange({ industryKey: null, customQuery: q.trim() });
    setQ("");
    setOpen(false);
  };

  const SelectedIcon = selected ? ICONS[selected.key] ?? Search : customQuery ? Search : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            "flex h-16 w-full items-center gap-3.5 rounded-2xl border border-input bg-card px-3.5 text-left transition-[border-color,background-color,box-shadow] duration-200 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
            open && "border-foreground/30",
          )}
        >
          {SelectedIcon ? (
            <IconTile icon={SelectedIcon} selected />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-dashed border-foreground/25 text-muted-foreground">
              <Search className="size-[18px]" strokeWidth={1.9} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            {selected ? (
              <>
                <span className="block truncate text-[15px] font-medium">{selected.label[lang]}</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">{lang === "nl" ? selected.label.en : selected.label.nl}</span>
              </>
            ) : customQuery ? (
              <>
                <span className="block truncate text-[15px] font-medium">“{customQuery}”</span>
                <span className="block truncate text-[12.5px] text-muted-foreground">{T.custom[lang]}</span>
              </>
            ) : (
              <span className="block text-[15px] text-muted-foreground">{T.placeholder[lang]}</span>
            )}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" sideOffset={8} className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] rounded-3xl p-0 shadow-flyout">
        <div className="border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const first = visibleGroups[0]?.items[0];
                if (exactMatch) pick(exactMatch.key);
                else if (first && !showCustom) pick(first.key);
                else if (showCustom) pickCustom();
              }}
              placeholder={T.search[lang]}
              className="h-11 rounded-xl pl-10"
            />
          </div>
        </div>

        <div className="max-h-[min(60vh,520px)] overflow-y-auto p-3">
          {visibleGroups.map((g) => (
            <div key={g.label.en} className="mb-4 last:mb-0">
              <p className="eyebrow mb-2 px-1">{g.label[lang]}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((i) => {
                  const Ico = ICONS[i.key] ?? Search;
                  const isSel = i.key === industryKey;
                  return (
                    <button
                      key={i.key}
                      type="button"
                      onClick={() => pick(i.key)}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-left transition-[background-color,border-color,transform] duration-150 hover:bg-surface-hover active:scale-[0.99]",
                        isSel && "border-foreground/40",
                      )}
                    >
                      <IconTile icon={Ico} selected={isSel} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium">{i.label[lang]}</span>
                        <span className="block truncate text-[12px] text-muted-foreground">{lang === "nl" ? i.label.en : i.label.nl}</span>
                      </span>
                      {isSel && <Check className="size-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {showCustom && (
            <div className={cn(visibleGroups.length > 0 && "mt-2 border-t border-border pt-3")}>
              <p className="eyebrow mb-2 px-1">{T.custom[lang]}</p>
              <button type="button" onClick={pickCustom} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-foreground/30 bg-card px-3 py-2.5 text-left transition-colors hover:bg-surface-hover">
                <IconTile icon={Search} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{T.useCustom[lang]}: “{q.trim()}”</span>
                  <span className="block text-[12px] leading-snug text-muted-foreground">{T.hint[lang]}</span>
                </span>
              </button>
            </div>
          )}

          {visibleGroups.length === 0 && !showCustom && <p className="px-1 py-6 text-center text-[13.5px] text-muted-foreground">{lang === "nl" ? "Typ minimaal twee tekens voor een eigen zoekterm." : "Type at least two characters for a custom term."}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
