import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { integrationStatus } from "@/lib/env";
import { ProspectDetail } from "@/components/prospect-detail/prospect-detail";

export default async function ProspectPage(props: PageProps<"/prospects/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const prospect = await prisma.prospect.findFirst({
    where: { id, userId: user.id },
    include: {
      analysis: true,
      notes: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
      outreach: { orderBy: { createdAt: "asc" } },
      lists: { include: { list: { select: { id: true, name: true } } } },
      scans: { include: { scan: { select: { id: true, name: true, createdAt: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!prospect) notFound();
  const lists = await prisma.list.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const settings = await prisma.userSettings.findUnique({ where: { userId: user.id } });
  const status = integrationStatus();

  return (
    <ProspectDetail
      prospect={JSON.parse(JSON.stringify(prospect))}
      lists={lists}
      initialTab={typeof sp.tab === "string" ? sp.tab : undefined}
      aiConfigured={status.ai}
      outreachLanguage={settings?.outreachLanguage ?? "en"}
    />
  );
}
