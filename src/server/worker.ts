import "dotenv/config";
import { getBoss, QUEUES, scheduleFollowUpReminders, type ProspectAnalyzeJob, type ProspectAiJob, type RadarRunJob, type ScanDiscoverJob } from "./jobs/queue";
import { sendDueFollowUpReminders } from "./jobs/reminders";
import { runScanDiscovery } from "./jobs/discover";
import { analyzeProspect } from "./jobs/analyze";
import { admitRadarResults, runRadar } from "./jobs/radar";
import { closeBrowser } from "./analysis/browser";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

/**
 * Joyscrape background worker. Run alongside `next dev` / `next start`:
 *   npm run worker
 */
async function main() {
  const boss = await getBoss();
  console.log(`[worker] connected · analyze concurrency ${env.analyzeConcurrency} · storage ${env.storageDir}`);

  await boss.work<ScanDiscoverJob>(QUEUES.scanDiscover, { batchSize: 1, pollingIntervalSeconds: 1 }, async ([job]) => {
    console.log(`[worker] scan.discover ${job.data.scanId}`);
    await runScanDiscovery(job.data.scanId);
  });

  await boss.work<ProspectAnalyzeJob>(QUEUES.prospectAnalyze, { batchSize: 1, pollingIntervalSeconds: 1 }, async ([job]) => {
    const t = Date.now();
    await analyzeProspect(job.data);
    console.log(`[worker] prospect.analyze ${job.data.prospectId} · ${Math.round((Date.now() - t) / 1000)}s`);
    if (job.data.scanId) await maybeFinishRadar(job.data.scanId);
  });
  // Additional parallel workers on the analyze queue
  for (let i = 1; i < env.analyzeConcurrency; i++) {
    await boss.work<ProspectAnalyzeJob>(QUEUES.prospectAnalyze, { batchSize: 1, pollingIntervalSeconds: 1 }, async ([job]) => {
      const t = Date.now();
      await analyzeProspect(job.data);
      console.log(`[worker#${i}] prospect.analyze ${job.data.prospectId} · ${Math.round((Date.now() - t) / 1000)}s`);
      if (job.data.scanId) await maybeFinishRadar(job.data.scanId);
    });
  }

  await boss.work<ProspectAiJob>(QUEUES.prospectAi, { batchSize: 1, pollingIntervalSeconds: 2 }, async ([job]) => {
    await analyzeProspect({ prospectId: job.data.prospectId, force: true, runAi: true });
  });

  await boss.work<RadarRunJob>(QUEUES.radarRun, { batchSize: 1, pollingIntervalSeconds: 5 }, async ([job]) => {
    console.log(`[worker] radar.run ${job.data.radarId}`);
    await runRadar(job.data.radarId);
  });

  await boss.work(QUEUES.followUpReminders, { batchSize: 1, pollingIntervalSeconds: 30 }, async () => {
    const r = await sendDueFollowUpReminders();
    if (!r.skipped) console.log(`[worker] followup.reminders · ${r.sent} sent`);
  });
  await scheduleFollowUpReminders(boss);

  // Recover scans stuck in RUNNING from a previous crash: re-finalise counters.
  const stuck = await prisma.scan.findMany({ where: { status: "RUNNING" }, select: { id: true } });
  for (const s of stuck) {
    const pending = await prisma.scanProspect.count({ where: { scanId: s.id, status: { in: ["PENDING", "ANALYZING"] } } });
    if (pending === 0) await prisma.scan.update({ where: { id: s.id }, data: { status: "COMPLETED", stage: "Done", completedAt: new Date() } }).catch(() => {});
    else await prisma.scanProspect.updateMany({ where: { scanId: s.id, status: "ANALYZING" }, data: { status: "PENDING", stage: "Queued for analysis" } });
  }

  const shutdown = async () => {
    console.log("[worker] shutting down…");
    await boss.stop({ graceful: true, timeout: 30_000 }).catch(() => {});
    await closeBrowser();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const finishedRadarScans = new Set<string>();
async function maybeFinishRadar(scanId: string) {
  if (finishedRadarScans.has(scanId)) return;
  const scan = await prisma.scan.findUnique({ where: { id: scanId }, select: { status: true, radarId: true } });
  if (scan?.status === "COMPLETED" && scan.radarId) {
    finishedRadarScans.add(scanId);
    await admitRadarResults(scanId).catch((e) => console.error("[worker] radar admit failed", e));
  }
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
