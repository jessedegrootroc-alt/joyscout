"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Building2, ListChecks, History, MessageSquareText, CalendarClock, Radar, Settings, Bookmark, ClipboardPaste } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

export const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/find", label: "Find prospects", icon: Search },
      { href: "/import", label: "Import list", icon: ClipboardPaste },
      { href: "/prospects", label: "Prospects", icon: Building2 },
      { href: "/lists", label: "Lists", icon: ListChecks },
      { href: "/scans", label: "Scrapes", icon: History },
    ],
  },
  {
    label: "Outreach",
    items: [
      { href: "/outreach", label: "Outreach", icon: MessageSquareText },
      { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
    ],
  },
  {
    label: "Automation",
    items: [
      { href: "/radar", label: "Radar", icon: Radar },
      { href: "/saved-searches", label: "Saved searches", icon: Bookmark },
    ],
  },
];

export function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppSidebar({ counts }: { counts?: { followUpsDue?: number } }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/" aria-label="Joyscrape, dashboard">
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-6 px-4 pt-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="eyebrow mb-2 px-3">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                const badge = item.href === "/follow-ups" ? counts?.followUpsDue : undefined;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-full border border-transparent px-3 text-[14px] font-medium text-foreground/70 transition-colors duration-200 hover:bg-foreground/5 hover:text-foreground",
                        active && "border-border bg-card text-foreground hover:bg-card",
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-foreground/50")} />
                      <span className="flex-1">{item.label}</span>
                      {badge ? <span className="rounded-full bg-tint-orange/25 px-2 py-0.5 font-mono text-[11px] font-medium text-foreground">{badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-4 pb-5">
        <Link
          href="/settings"
          className={cn(
            "flex h-9 items-center gap-2.5 rounded-full border border-transparent px-3 text-[14px] font-medium text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground",
            pathname.startsWith("/settings") && "border-border bg-card text-foreground hover:bg-card",
          )}
        >
          <Settings className="size-4 text-foreground/50" /> Settings
        </Link>
      </div>
    </aside>
  );
}
