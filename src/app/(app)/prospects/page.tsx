import { requireUser } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { parseFilters, queryProspects, serializeRow } from "@/server/prospects/query";
import { PageHeader } from "@/components/page-header";
import { ProspectFilters } from "@/components/prospect-filters";
import { ProspectTable } from "@/components/prospect-table";
import { Pagination } from "@/components/pagination";

export const metadata = { title: "Prospects" };

export default async function ProspectsPage(props: PageProps<"/prospects">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const filters = parseFilters(sp);
  const [{ rows, total, page, pageSize }, lists, cities, industries, scan, list] = await Promise.all([
    queryProspects(user.id, filters),
    prisma.list.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.prospect.findMany({ where: { userId: user.id, city: { not: null } }, distinct: ["city"], select: { city: true }, orderBy: { city: "asc" }, take: 200 }),
    prisma.prospect.findMany({ where: { userId: user.id }, distinct: ["industry"], select: { industry: true }, orderBy: { industry: "asc" }, take: 100 }),
    filters.scanId ? prisma.scan.findFirst({ where: { id: filters.scanId, userId: user.id }, select: { name: true } }) : null,
    filters.listId ? prisma.list.findFirst({ where: { id: filters.listId, userId: user.id }, select: { name: true } }) : null,
  ]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHeader
        eyebrow="Database"
        title="Prospects"
        description={
          <>
            {total} prospect{total === 1 ? "" : "s"}
            {scan ? ` from scan “${scan.name}”` : ""}
            {list ? ` in list “${list.name}”` : ""}
          </>
        }
      />
      <ProspectFilters cities={cities.map((c) => c.city!).filter(Boolean)} industries={industries.map((i) => i.industry)} />
      <div className="mt-5">
        <ProspectTable rows={rows.map(serializeRow)} lists={lists} total={total} emptyMessage="No prospects match these filters. Run a scan or loosen the filters." />
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
