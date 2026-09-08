import { prisma } from "@/lib/prisma";
import type { ActivityType } from "@/generated/prisma/enums";

export async function logActivity(prospectId: string, userId: string, type: ActivityType, message: string, metadata?: Record<string, unknown>) {
  await prisma.activity.create({ data: { prospectId, userId, type, message, metadata: metadata as never } });
  await prisma.prospect.update({ where: { id: prospectId }, data: { lastActivityAt: new Date() } }).catch(() => {});
}
