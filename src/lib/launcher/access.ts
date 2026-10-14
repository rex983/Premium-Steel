import { createAdminClient } from "@/lib/supabase/admin";

/** This app's JWT audience as registered in the launcher (launcher_sso_configs.jwt_audience). */
export const LAUNCHER_AUDIENCE = "psb-pricing";

/**
 * Result of launcher_can_open_app for this app:
 *   granted - the RPC returned exactly true
 *   denied  - false, or NULL (no active launcher app registered for the audience)
 *   error   - RPC missing (PGRST202 / 42883 / PGRST204) or a transient failure
 * Access is fail-CLOSED: sign-in requires "granted"; the 60s recheck ends the
 * session on "denied" and tolerates "error" only for a short grace window.
 */
export type LauncherAccess = "granted" | "denied" | "error";

const MISSING_RPC_CODES = new Set(["PGRST202", "42883", "PGRST204"]);

export async function checkLauncherAccess(profileId: string): Promise<LauncherAccess> {
  try {
    const { data, error } = await createAdminClient().rpc("launcher_can_open_app", {
      p_profile_id: profileId,
      p_audience: LAUNCHER_AUDIENCE,
    });
    if (error) {
      console.warn(
        MISSING_RPC_CODES.has(error.code ?? "")
          ? "[launcher-access] launcher_can_open_app RPC not deployed; denying"
          : "[launcher-access] launcher_can_open_app failed; denying",
        error.message,
      );
      return "error";
    }
    if (data === null || data === undefined) {
      console.warn(`[launcher-access] no active launcher app registered with audience "${LAUNCHER_AUDIENCE}"; denying`);
      return "denied";
    }
    return data === true ? "granted" : "denied";
  } catch (err) {
    console.warn("[launcher-access] launcher_can_open_app threw; denying", err);
    return "error";
  }
}

/**
 * Permission role for in-app checks: launcher_permission_role(role) =
 * coalesce(launcher_roles.acts_as, name). Falls back to the real role when the
 * function is missing or fails. acts_as can never grant admin: "admin" is only
 * returned for role === "admin".
 */
export async function launcherPermissionRole(role: string | null | undefined): Promise<string> {
  const real = role ?? "";
  if (!real) return real;
  try {
    const { data, error } = await createAdminClient().rpc("launcher_permission_role", { p_role: real });
    if (error || typeof data !== "string" || !data) return real;
    if (data === "admin" && real !== "admin") return real;
    return data;
  } catch {
    return real;
  }
}
