"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "./logo";
import { NAV_GROUPS, isActivePath } from "./app-sidebar";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="size-9 md:hidden" aria-label="Open navigation">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex h-16 items-center px-6">
          <Logo />
        </div>
        <nav className="space-y-6 px-4 pb-6">
          {NAV_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="eyebrow mb-2 px-3">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn("flex h-10 items-center gap-2.5 rounded-full border border-transparent px-3 text-[15px] font-medium text-foreground/75 hover:bg-foreground/5", isActivePath(pathname, item.href) && "border-border bg-card text-foreground")}
                    >
                      <item.icon className="size-4 text-foreground/50" /> {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Link href="/settings" onClick={() => setOpen(false)} className="flex h-10 items-center gap-2.5 rounded-full px-3 text-[15px] font-medium text-foreground/75 hover:bg-foreground/5">
            <Settings className="size-4 text-foreground/50" /> Settings
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
