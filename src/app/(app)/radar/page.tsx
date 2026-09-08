import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { RadarList } from "@/components/radar-list";
import { RadarForm } from "@/components/radar-form";

export const metadata = { title: "Radar" };

export default async function RadarPage() {
  const user = await requireUser();
  const [radars, lists, settings] = await Promise.all([
    prisma.radar.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { list: { select: { id: true, name: true, _count: { select: { prospects: true } } } }, scans: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, stage: true, totalNew: true, totalFound: true, createdAt: true } } } }),
    prisma.list.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.userSettings.findUnique({ where: { userId: user.id } }),
  ]);
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow="Automation" title="Prospect Radar" description="Pick an industry, a location and filters. LeadLens scans on your cadence and drops new prospects into a list. Duplicates are skipped." actions={<RadarForm lists={lists} defaultCountry={settings?.defaultCountry ?? "NL"} />} />
      <RadarList radars={JSON.parse(JSON.stringify(radars))} />
    </div>
  );
}
