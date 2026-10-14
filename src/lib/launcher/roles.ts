import type { UserRole } from "@/types/auth";

/**
 * Built-in launcher roles (launcher_roles.name). Admins can add custom roles in
 * the launcher; anything not listed here gets the least-privileged behaviour
 * (own quotes only, read-only) rather than an error or elevated access.
 */
export const LAUNCHER_ROLES = [
  "admin",
  "senior_manager",
  "junior_manager",
  "team_lead",
  "sales_rep",
  "bst",
  "rnd",
  "cancellations_dept",
  "revisions_dept",
] as const;

const KNOWN = new Set<string>(LAUNCHER_ROLES);

export function isKnownLauncherRole(role: string | null | undefined): boolean {
  return !!role && KNOWN.has(role);
}

/** Only sees / edits quotes they created (sales reps, and unknown/custom roles). */
export function isOwnQuotesOnly(role: UserRole | null | undefined): boolean {
  return role === "sales_rep" || !isKnownLauncherRole(role);
}

/** Cannot modify quotes at all (unknown/custom launcher roles; replaces the old PSB-only "viewer"). */
export function isReadOnlyRole(role: UserRole | null | undefined): boolean {
  return !isKnownLauncherRole(role);
}
