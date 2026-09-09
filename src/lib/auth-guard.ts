import { prisma } from "./prisma";

/**
 * Joyscrape runs as a single workspace without login. Every record is still
 * scoped to a user row so multi-user support can be re-enabled later; here that
 * row is the workspace owner (the first user ever created, or a default one).
 */
export type AuthedUser = { id: string; email: string; name: string };

export const DEFAULT_WORKSPACE_NAME = "Workspace";
const DEFAULT_EMAIL = "owner@joyscrape.local";

let cached: AuthedUser | null = null;

export async function getWorkspaceUser(): Promise<AuthedUser> {
  if (cached) return cached;
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true } });
  if (existing) return (cached = existing);
  // Upsert (INSERT … ON CONFLICT) so parallel server components on a fresh
  // database cannot race each other into a unique-constraint error.
  const created = await prisma.user.upsert({
    where: { id: "workspace-owner" },
    create: { id: "workspace-owner", email: DEFAULT_EMAIL, name: DEFAULT_WORKSPACE_NAME },
    update: {},
    select: { id: true, email: true, name: true },
  });
  return (cached = created);
}

/** For server components / server actions. */
export async function requireUser(): Promise<AuthedUser> {
  return getWorkspaceUser();
}

/** For route handlers. Kept async + nullable so handlers keep their shape. */
export async function getApiUser(_req: Request): Promise<AuthedUser | null> {
  return getWorkspaceUser();
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
