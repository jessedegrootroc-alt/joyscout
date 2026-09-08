/** Dev tool: list the latest scans for the DATABASE_URL in the environment. */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
const scans = await prisma.scan.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, name: true, status: true, stage: true, totalFound: true, analyzedCount: true, noWebsiteCount: true, failedCount: true, createdAt: true } });
console.table(scans.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })));
await prisma.$disconnect();
