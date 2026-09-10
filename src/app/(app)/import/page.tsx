import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { integrationStatus } from "@/lib/env";
import { PageHeader } from "@/components/page-header";
import { ImportForm } from "@/components/import-form";

export const metadata = { title: "Import" };

export default async function ImportPage() {
  const user = await requireUser();
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const status = integrationStatus();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="From a list" title="Import businesses" description="Found companies in a Facebook group, a directory or a spreadsheet? Paste the names and Joyscrape turns them into analysed prospects." />
      <ImportForm defaultCountry={settings?.defaultCountry ?? "NL"} googleConfigured={status.googlePlaces} />
    </div>
  );
}
