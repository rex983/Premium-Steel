import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { assertNotViewingAs, ViewAsReadOnlyError } from "@/lib/launcher-kit/view-as";
import type { ViewAs } from "@/types/auth";

/**
 * Defense in depth behind the middleware block, for route handlers: the kit's
 * assertNotViewingAs() as a 403 response instead of a throw. Null when the
 * session isn't an admin "View as".
 */
export async function rejectIfViewingAs(): Promise<NextResponse | null> {
  const session = (await (auth as unknown as () => Promise<unknown>)()) as
    | { user?: { name?: string | null }; viewAs?: ViewAs | null }
    | null;
  try {
    assertNotViewingAs(session);
    return null;
  } catch (e) {
    if (e instanceof ViewAsReadOnlyError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }
}
