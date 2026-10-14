import type { DefaultSession } from "next-auth";

/** Built-in launcher roles; custom launcher roles arrive as arbitrary strings. */
export type LauncherRoleName =
  | "admin"
  | "senior_manager"
  | "junior_manager"
  | "team_lead"
  | "sales_rep"
  | "bst"
  | "rnd"
  | "cancellations_dept"
  | "revisions_dept";
export type UserRole = LauncherRoleName | (string & {});
// profiles.office / profiles.department values. The launcher owns the lists
// (launcher_offices / launcher_departments) and admins can add new ones, so
// these are plain strings; read the current options via src/lib/launcher/org.ts.
export type Office = string;
export type Department = string;

/** Admin "View as" (launcher-initiated, read-only impersonation). */
export interface ViewAs {
  actorProfileId: string;
  actorEmail: string;
  actorName: string | null;
  startedAt: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  office: Office | null;
  department: Department | null;
  is_it: boolean | null;
  is_active?: boolean | null;
  created_at: string;
  updated_at: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      /** Real launcher role (display only). */
      role: UserRole;
      /** Permission role = launcher_permission_role(role); use for EVERY in-app permission check. */
      permRole: UserRole;
      profileId: string;
      office?: Office;
      department?: Department | null;
      isIt?: boolean;
    } & DefaultSession["user"];
    /** Set while an admin is viewing the app as this user (read-only). */
    viewAs: ViewAs | null;
  }

  interface JWT {
    role?: UserRole;
    permRole?: UserRole;
    breakGlass?: boolean;
    accessOkAt?: number;
    profileId?: string;
    office?: Office;
    department?: Department | null;
    isIt?: boolean;
    viewAs?: ViewAs | null;
  }
}
