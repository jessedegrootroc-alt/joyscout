/**
 * Queue a forced re-analysis for every prospect with a website (all users).
 *   npx tsx --tsconfig tsconfig.json scripts/reanalyze-all.mts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { enqueueAnalyze, getBoss } from "@/server/jobs/queue";

const rows = await prisma.prospect.findMany({ where: { hasWebsite: true }, select: { id: true } });
for (const r of rows) await enqueueAnalyze({ prospectId: r.id, force: true }, 50);
await prisma.prospect.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { analysisStatus: "PENDING" } });
console.log(`queued ${rows.length} re-analyses`);
await (await getBoss()).stop({ graceful: false });
await prisma.$disconnect();
process.exit(0);
