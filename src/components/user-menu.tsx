"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const AVATAR_TINTS = ["bg-tint-blue/30", "bg-tint-green/35", "bg-tint-yellow/40", "bg-tint-orange/30", "bg-tint-pink/40"];

export function UserMenu({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const tint = AVATAR_TINTS[[...email].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2.5 rounded-full pl-1 pr-3">
          <span className={`flex size-7 items-center justify-center rounded-full text-[11px] font-medium text-foreground ${tint}`}>{initials}</span>
          <span className="hidden max-w-[140px] truncate text-[14px] lg:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="px-2 py-2 font-normal">
          <div className="truncate text-[14px] font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            router.push("/login");
            router.refresh();
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
