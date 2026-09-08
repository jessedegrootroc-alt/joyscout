import { z } from "zod";
import { getApiUser, unauthorized } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUSES, OUTREACH_CHANNELS } from "@/lib/types";
import { logActivity } from "@/server/prospects/activity";
import { generateOutreachForProspect } from "@/server/ai/outreach";

const schema = z.object({
  action: z.enum(["add_to_list", "remove_from_list", "set_status", "mark_contacted", "generate_outreach", "delete", "set_follow_up"]),
  ids: z.array(z.string()).min(1).max(500),
  listId: z.string().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  channel: z.enum(OUTREACH_CHANNELS).optional(),
  followUpAt: z.string().datetime().nullable().optional(),
});

export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return unauthorized();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
  const { action, ids } = parsed.data;

  // Ownership check: only operate on the caller's prospects.
  const owned = await prisma.prospect.findMany({ where: { id: { in: ids }, userId: user.id }, select: { id: true, status: true, name: true } });
  const ownedIds = owned.map((p) => p.id);
  if (ownedIds.length === 0) return Response.json({ error: "No matching prospects" }, { status: 404 });

  switch (action) {
    case "add_to_list": {
      if (!parsed.data.listId) return Response.json({ error: "listId required" }, { status: 400 });
      const list = await prisma.list.findFirst({ where: { id: parsed.data.listId, userId: user.id } });
      if (!list) return Response.json({ error: "List not found" }, { status: 404 });
      await prisma.listProspect.createMany({ data: ownedIds.map((prospectId) => ({ listId: list.id, prospectId })), skipDuplicates: true });
      await Promise.all(ownedIds.map((id) => logActivity(id, user.id, "LIST_ADDED", `Added to list “${list.name}”`, { listId: list.id })));
      return Response.json({ ok: true, message: `Added ${ownedIds.length} to “${list.name}”` });
    }
    case "remove_from_list": {
      if (!parsed.data.listId) return Response.json({ error: "listId required" }, { status: 400 });
      const list = await prisma.list.findFirst({ where: { id: parsed.data.listId, userId: user.id } });
      if (!list) return Response.json({ error: "List not found" }, { status: 404 });
      await prisma.listProspect.deleteMany({ where: { listId: list.id, prospectId: { in: ownedIds } } });
      await Promise.all(ownedIds.map((id) => logActivity(id, user.id, "LIST_REMOVED", `Removed from list “${list.name}”`, { listId: list.id })));
      return Response.json({ ok: true, message: `Removed ${ownedIds.length} from “${list.name}”` });
    }
    case "set_status": {
      const status = parsed.data.status;
      if (!status) return Response.json({ error: "status required" }, { status: 400 });
      const now = new Date();
      await prisma.prospect.updateMany({
        where: { id: { in: ownedIds } },
        data: { status, lastActivityAt: now, ...(status === "CONTACTED" ? { contactedAt: now } : {}) },
      });
      await Promise.all(owned.filter((p) => p.status !== status).map((p) => logActivity(p.id, user.id, "STATUS_CHANGED", `Status changed from ${p.status} to ${status}`, { from: p.status, to: status })));
      return Response.json({ ok: true, message: `Status updated for ${ownedIds.length}` });
    }
    case "mark_contacted": {
      const now = new Date();
      await prisma.prospect.updateMany({ where: { id: { in: ownedIds } }, data: { status: "CONTACTED", contactedAt: now, lastActivityAt: now } });
      await Promise.all(ownedIds.map((id) => logActivity(id, user.id, "CONTACTED", "Marked as contacted")));
      return Response.json({ ok: true, message: `Marked ${ownedIds.length} as contacted` });
    }
    case "set_follow_up": {
      const followUpAt = parsed.data.followUpAt ? new Date(parsed.data.followUpAt) : null;
      await prisma.prospect.updateMany({ where: { id: { in: ownedIds } }, data: { followUpAt, lastActivityAt: new Date(), ...(followUpAt ? { status: "FOLLOW_UP" } : {}) } });
      if (followUpAt) await Promise.all(ownedIds.map((id) => logActivity(id, user.id, "FOLLOW_UP_SCHEDULED", `Follow-up scheduled for ${followUpAt.toDateString()}`)));
      return Response.json({ ok: true });
    }
    case "generate_outreach": {
      const channel = parsed.data.channel ?? "EMAIL";
      const limited = ownedIds.slice(0, 25);
      const results = await Promise.allSettled(limited.map((id) => generateOutreachForProspect({ prospectId: id, userId: user.id, channel, tone: "friendly", length: "medium" })));
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (ok === 0) return Response.json({ error: firstError ? String(firstError.reason?.message ?? firstError.reason) : "Generation failed" }, { status: 500 });
      return Response.json({ ok: true, message: `Generated ${ok} ${channel.toLowerCase()} message${ok === 1 ? "" : "s"}${ownedIds.length > 25 ? " (max 25 per batch)" : ""}${ok < limited.length ? `, ${limited.length - ok} failed` : ""}` });
    }
    case "delete": {
      await prisma.prospect.deleteMany({ where: { id: { in: ownedIds } } });
      return Response.json({ ok: true, message: `Deleted ${ownedIds.length}` });
    }
  }
}
