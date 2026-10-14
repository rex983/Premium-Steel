import { auth } from "@/auth";
import type { UserRole, Office, Department, ViewAs } from "@/types/auth";

export interface ActiveIdentity {
  /**
   * Permission role (launcher_permission_role: a custom launcher role's
   * acts_as, else the role itself). Every authorization check uses this.
   */
  role: UserRole;
  /** Real launcher role, for display only. */
  displayRole: UserRole;
  profileId: string;
  office?: Office;
  department?: Department | null;
  email?: string | null;
  name?: string | null;
  /** True while a launcher admin is viewing the app as this user (read-only). */
  isImpersonating: boolean;
  viewAs: ViewAs | null;
}

/**
 * The identity every authorization check uses. All fields come from the
 * session, which is synced from the launcher's profiles row every 60s. During
 * an admin "View as" the session already IS the target user (the launcher mints
 * the SSO token for them), so no extra lookup is needed here.
 */
export async function getActiveIdentity(): Promise<ActiveIdentity | null> {
  const session = await auth();
  if (!session?.user) return null;

  return {
    role: session.user.permRole,
    displayRole: session.user.role,
    profileId: session.user.profileId,
    office: session.user.office,
    department: session.user.department ?? null,
    email: session.user.email,
    name: session.user.name,
    isImpersonating: !!session.viewAs,
    viewAs: session.viewAs ?? null,
  };
}
