import Link from "next/link";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/page-header";
import { ListActions, NewListButton } from "@/components/list-actions";
import { fmtRelative } from "@/lib/format";

export const metadata = { title: "Lists" };

export default async function ListsPage() {
  const user = await requireUser();
  const lists = await prisma.list.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { prospects: true } }, radars: { select: { id: true, name: true } } },
  });
  const hot = await prisma.listProspect.groupBy({ by: ["listId"], where: { list: { userId: user.id }, prospect: { opportunityScore: { gte: 65 } } }, _count: { _all: true } });
  const hotBy = new Map(hot.map((h) => [h.listId, h._count._all]));

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader eyebrow="Organise" title="Lists" description="Group prospects into lists such as “Amsterdam Roofers” or “Contact this week”. A prospect can be in several lists." actions={<NewListButton />} />
      {lists.length === 0 ? (
        <EmptyState title="No lists yet" description="Create a list here or select prospects in a table and use “Add to list”." action={<NewListButton />} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <div key={l.id} className="surface surface-hover group relative p-5">
              <Link href={`/lists/${l.id}`} className="absolute inset-0" aria-label={l.name} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-[17px] font-medium tracking-tight">{l.name}</h2>
                  {l.description && <p className="mt-1 truncate text-[13px] text-muted-foreground">{l.description}</p>}
                </div>
                <div className="relative z-10">
                  <ListActions id={l.id} name={l.name} description={l.description} locked={l.radars.length > 0} />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-muted-foreground">
                <span className="whitespace-nowrap">
                  <b className="font-mono font-medium text-foreground">{l._count.prospects}</b> prospects
                </span>
                <span className="whitespace-nowrap">
                  <b className="font-mono font-medium text-foreground">{hotBy.get(l.id) ?? 0}</b> high opportunity
                </span>
                <span className="ml-auto whitespace-nowrap">{fmtRelative(l.updatedAt)}</span>
              </div>
              {l.radars.length > 0 && <div className="mt-3 inline-flex items-center rounded-full bg-tint-blue/14 px-2.5 py-0.5 text-[11.5px] text-[#1f4f9a]">Fed by radar: {l.radars.map((r) => r.name).join(", ")}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
