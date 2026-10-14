import { createAdminClient } from "@/lib/supabase/admin";

/** This app's JWT audience as registered in the launcher (launcher_sso_configs.jwt_audience). */
export const LAUNCHER_AUDIENCE = "psb-pricing";

const MISSING_RPC_CODES = new Set(["PGRST202", "42883", "PGRST204"]);
let warned = false;
function warnOnce(msg: string, detail?: unknown) {
  if (warned) return;
  warned = true;
  console.warn(`[launcher-access] ${msg}; failing open`, detail ?? "");
}

/**
 * Does the launcher grant this profile access to PSB Pricing?
 * The launcher is the source of truth (role × office grid, per-person grants,
 * legacy offices). Returns true (fail open) when the app isn't registered
 * (NULL), the RPC isn't deployed yet, or the call fails transiently.
 */
export async function launcherCanOpenApp(profileId: string): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc("launcher_can_open_app", {
      p_profile_id: profileId,
      p_audience: LAUNCHER_AUDIENCE,
    });
    if (error) {
      warnOnce(
        MISSING_RPC_CODES.has(error.code ?? "")
          ? "launcher_can_open_app RPC not deployed"
          : "launcher_can_open_app failed",
        error.message,
      );
      return true;
    }
    if (data === null || data === undefined) {
      warnOnce(`no active launcher app registered with audience "${LAUNCHER_AUDIENCE}"`);
      return true;
    }
    return data === true;
  } catch (err) {
    warnOnce("launcher_can_open_app threw", err);
    return true;
  }
}
