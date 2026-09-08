import { PgBoss } from "pg-boss";

/**
 * pg-boss queue definitions. The web app only *sends* jobs; the worker
 * process (src/server/worker.ts) registers the handlers.
 */
export const QUEUES = {
  scanDiscover: "scan.discover",
  prospectAnalyze: "prospect.analyze",
  prospectAi: "prospect.ai",
  radarRun: "radar.run",
} as const;

export type ScanDiscoverJob = { scanId: string };
export type ProspectAnalyzeJob = { prospectId: string; scanId?: string; force?: boolean };
export type ProspectAiJob = { prospectId: string; force?: boolean };
export type RadarRunJob = { radarId: string };

const globalForBoss = globalThis as unknown as { boss?: PgBoss; bossStarting?: Promise<PgBoss> };

export async function getBoss(): Promise<PgBoss> {
  if (globalForBoss.boss) return globalForBoss.boss;
  if (globalForBoss.bossStarting) return globalForBoss.bossStarting;
  globalForBoss.bossStarting = (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const boss = new PgBoss({
      connectionString: url,
      schema: "pgboss",
      max: 5,
      application_name: "joyscrape",
    });
    boss.on("error", (err) => console.error("[pg-boss]", err));
    await boss.start();
    await ensureQueues(boss);
    globalForBoss.boss = boss;
    return boss;
  })();
  return globalForBoss.bossStarting;
}

export async function ensureQueues(boss: PgBoss) {
  await boss.createQueue(QUEUES.scanDiscover, { retryLimit: 2, retryDelay: 15, retryBackoff: true, expireInSeconds: 60 * 20 });
  await boss.createQueue(QUEUES.prospectAnalyze, { retryLimit: 1, retryDelay: 20, retryBackoff: true, expireInSeconds: 60 * 10 });
  await boss.createQueue(QUEUES.prospectAi, { retryLimit: 1, retryDelay: 30, retryBackoff: true, expireInSeconds: 60 * 5 });
  await boss.createQueue(QUEUES.radarRun, { retryLimit: 1, retryDelay: 60, expireInSeconds: 60 * 5 });
}

export async function enqueueScan(scanId: string) {
  const boss = await getBoss();
  return boss.send(QUEUES.scanDiscover, { scanId } satisfies ScanDiscoverJob, { singletonKey: `scan:${scanId}` });
}

export async function enqueueAnalyze(job: ProspectAnalyzeJob, priority = 0) {
  const boss = await getBoss();
  return boss.send(QUEUES.prospectAnalyze, job, { singletonKey: `analyze:${job.prospectId}`, priority });
}

export async function enqueueAi(job: ProspectAiJob) {
  const boss = await getBoss();
  return boss.send(QUEUES.prospectAi, job, { singletonKey: `ai:${job.prospectId}` });
}

export async function scheduleRadar(radarId: string, cron: string, timezone = "Europe/Amsterdam") {
  const boss = await getBoss();
  await boss.schedule(QUEUES.radarRun, cron, { radarId } satisfies RadarRunJob, { key: `radar-${radarId}`, tz: timezone });
}

export async function unscheduleRadar(radarId: string) {
  const boss = await getBoss();
  await boss.unschedule(QUEUES.radarRun, `radar-${radarId}`);
}

export async function enqueueRadarNow(radarId: string) {
  const boss = await getBoss();
  return boss.send(QUEUES.radarRun, { radarId } satisfies RadarRunJob, { singletonKey: `radar-now:${radarId}` });
}
