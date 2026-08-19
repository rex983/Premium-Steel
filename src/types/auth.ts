import type { DefaultSession } from "next-auth";

export type UserRole =
  | "admin"
  | "manager"
  | "sales_rep"
  | "viewer"
  | "senior_manager"
  | "junior_manager"
  | "team_lead"
  | "cancellations_dept"
  | "revisions_dept"
  | "bst"
  | "rnd";
// Matches the launcher's shared profiles.office column.
export type Office = "Harbor" | "Marion" | "BST" | "RnD";
// Matches the launcher's shared profiles.department column.
export type Department = "SALES TEAM" | "BST" | "RnD";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  office: Office | null;
  department: Department | null;
  is_it: boolean | null;
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
    } & DefaultSession["user"];
  }

  interface JWT {
    role?: UserRole;
    profileId?: string;
    office?: Office;
    department?: Department | null;
  }
}
