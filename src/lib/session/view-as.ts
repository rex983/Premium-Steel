import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { ViewAs } from "@/types/auth";


export function readOnlyMessage(targetName: string | null | undefined): string {
  return `Read-only: viewing as ${targetName || "another user"}`;
}

/**
 * Defense in depth behind the middleware block: returns a 403 response when the
 * current session is an admin "View as" session, otherwise null.
 */
export async function viewAsWriteBlock(): Promise<NextResponse | null> {
  const session = (await (auth as unknown as () => Promise<unknown>)()) as
    | { user?: { name?: string | null; email?: string | null }; viewAs?: ViewAs | null }
    | null;
  if (!session?.viewAs) return null;
  return NextResponse.json(
    { error: readOnlyMessage(session.user?.name || session.user?.email) },
    { status: 403 },
  );
}
