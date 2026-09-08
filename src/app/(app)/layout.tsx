import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { AppSidebar } from "@/components/app-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { UserMenu } from "@/components/user-menu";
import { MobileNav } from "@/components/mobile-nav";
import { Logo } from "@/components/logo";
import Link from "next/link";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const followUpsDue = await prisma.prospect.count({
    where: { userId: user.id, followUpAt: { lte: new Date() }, status: { notIn: ["WON", "LOST", "NOT_INTERESTED"] } },
  });

  return (
    <div className="flex min-h-screen flex-1">
      <AppSidebar counts={{ followUpsDue }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/75 px-5 backdrop-blur-md md:px-8">
          <MobileNav />
          <Link href="/" className="md:hidden" aria-label="LeadLens, dashboard">
            <Logo compact />
          </Link>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <UserMenu />
          </div>
        </header>
        <main className="page-enter flex-1 px-5 py-8 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
