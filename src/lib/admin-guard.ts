import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { UserRole } from "@/types/auth";

/**
 * Admin route guard.
 *
 * NextAuth v5's `auth()` has multiple overloads (one for middleware, one for plain
 * RSC/route-handler context). TypeScript can resolve the wrong overload and infer
 * `NextMiddleware` instead of `Session | null`, which breaks `.user` access.
 * Centralising the guard here keeps the cast in one place and stops bleeding into
 * every API route.
 */
export async function requireAdmin(): Promise<
  | { ok: true; email: string | null | undefined; profileId: string }
  | { ok: false; res: NextResponse }
> {
  const sessionRaw = (await (auth as unknown as () => Promise<unknown>)()) as
    | { user?: { email?: string | null; role?: UserRole; profileId?: string } }
    | null;
  const user = sessionRaw?.user;
  if (!user || user.role !== "admin") {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, email: user.email, profileId: user.profileId ?? "" };
}
