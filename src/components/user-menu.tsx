import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Header shortcut to the workspace settings (the app has no accounts). */
export function UserMenu() {
  return (
    <Button asChild variant="outline" size="sm" className="gap-2">
      <Link href="/settings">
        <Settings className="size-3.5" /> Settings
      </Link>
    </Button>
  );
}
