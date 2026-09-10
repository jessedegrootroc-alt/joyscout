import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Header shortcut to the workspace settings (the app has no accounts). Icon-only on small screens. */
export function UserMenu() {
  return (
    <Button asChild variant="outline" size="sm" className="shrink-0 gap-2 px-2.5 sm:px-3.5" aria-label="Settings">
      <Link href="/settings">
        <Settings className="size-3.5" />
        <span className="hidden sm:inline">Settings</span>
      </Link>
    </Button>
  );
}
