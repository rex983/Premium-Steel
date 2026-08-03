import type { DefaultSession } from "next-auth";

export type UserRole = "admin" | "manager" | "sales_rep" | "viewer";
// Matches the launcher's shared profiles.office column.
export type Office = "Harbor" | "Marion" | "BST" | "RnD";

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  office: Office | null;
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
    } & DefaultSession["user"];
  }

  interface JWT {
    role?: UserRole;
    profileId?: string;
    office?: Office;
  }
}
