import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export type AuthedUser = { id: string; email: string; name: string };

/** For server components / server actions: redirects to /login when signed out. */
export async function requireUser(): Promise<AuthedUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

/** For route handlers: returns null when signed out (caller responds 401). */
export async function getApiUser(req: Request): Promise<AuthedUser | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name };
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
