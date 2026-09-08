import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { ScanLiveView } from "@/components/scan-live-view";
import { prospectRowSelect, serializeRow } from "@/server/prospects/query";

export default async function ScanDetailPage(props: PageProps<"/scans/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const scan = await prisma.scan.findFirst({ where: { id, userId: user.id } });
  if (!scan) notFound();
  const prospects = await prisma.prospect.findMany({
    where: { userId: user.id, scans: { some: { scanId: id } } },
    orderBy: [{ opportunityScore: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    select: prospectRowSelect,
    take: 500,
  });
  const lists = await prisma.list.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <ScanLiveView
      initialScan={JSON.parse(JSON.stringify(scan))}
      initialRows={prospects.map(serializeRow)}
      lists={lists}
    />
  );
}
