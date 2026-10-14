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
// Matches the launcher's shared profiles.office column.
export type Office = "Sales" | "BST" | "RnD";
// Matches the launcher's shared profiles.department column.
export type Department = "SALES TEAM" | "BST" | "RnD";

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
      role: UserRole;
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
    profileId?: string;
    office?: Office;
    department?: Department | null;
    isIt?: boolean;
    viewAs?: ViewAs | null;
  }
}
