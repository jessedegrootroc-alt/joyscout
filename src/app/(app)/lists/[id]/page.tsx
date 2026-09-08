import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseFilters, queryProspects, serializeRow } from "@/server/prospects/query";
import { PageHeader } from "@/components/page-header";
import { ProspectFilters } from "@/components/prospect-filters";
import { ProspectTable } from "@/components/prospect-table";
import { Pagination } from "@/components/pagination";
import { ListActions } from "@/components/list-actions";

export default async function ListDetailPage(props: PageProps<"/lists/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const list = await prisma.list.findFirst({ where: { id, userId: user.id }, include: { radars: { select: { id: true } } } });
  if (!list) notFound();
  const filters = { ...parseFilters(sp), listId: id };
  const [{ rows, total, page, pageSize }, lists, cities, industries] = await Promise.all([
    queryProspects(user.id, filters),
    prisma.list.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.prospect.findMany({ where: { userId: user.id, lists: { some: { listId: id } }, city: { not: null } }, distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } }),
    prisma.prospect.findMany({ where: { userId: user.id, lists: { some: { listId: id } } }, distinct: ["industry"], select: { industry: true }, orderBy: { industry: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-[1600px]">
      <Link href="/lists" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" /> Lists
      </Link>
      <PageHeader eyebrow="List" title={list.name} description={list.description ?? `${total} prospect${total === 1 ? "" : "s"} in this list`} actions={<ListActions id={list.id} name={list.name} description={list.description} locked={list.radars.length > 0} redirectOnDelete />} />
      <ProspectFilters cities={cities.map((c) => c.city!)} industries={industries.map((i) => i.industry)} />
      <div className="mt-5">
        <ProspectTable rows={rows.map(serializeRow)} lists={lists} total={total} emptyMessage="This list is empty. Select prospects in any table and choose “Add to list”." />
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
