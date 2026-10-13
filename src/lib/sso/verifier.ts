import { createRemoteJWKSet, jwtVerify } from "jose";
import { createAdminClient } from "@/lib/supabase/admin";

// Public JWKS endpoint published by the BBD Launcher (its IdP).
// Override via LAUNCHER_JWKS_URL on Vercel if launcher moves.
const JWKS_URL =
  process.env.LAUNCHER_JWKS_URL ||
  "https://bbd-launcher.vercel.app/api/sso/jwks";

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

const AUDIENCE = "psb-pricing";

export interface LauncherSsoClaims {
  sub: string;
  email: string;
  name: string;
  role: string;
  profile_id: string;
}

export async function verifyLauncherSsoToken(
  token: string,
): Promise<LauncherSsoClaims> {
  const { payload } = await jwtVerify(token, JWKS, {
    algorithms: ["ES256"],
    issuer: "bbd-launcher",
    audience: AUDIENCE,
    maxTokenAge: "120s",
    clockTolerance: "10s",
  });

  if (typeof payload.email !== "string") {
    throw new Error("SSO token missing email claim");
  }
  if (typeof payload.jti !== "string" || !payload.jti) {
    throw new Error("SSO token missing jti claim");
  }

  await consumeJti(payload.jti, payload.exp);

  return {
    sub: String(payload.sub ?? payload.email),
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : "",
    role: typeof payload.role === "string" ? payload.role : "",
    profile_id:
      typeof payload.profile_id === "string"
        ? payload.profile_id
        : String(payload.sub ?? ""),
  };
}

/**
 * Replay protection: each launcher token (jti) may be redeemed once. The
 * `sso_consumed_jti` table is owned by the launcher's migrations; until it
 * exists we log and allow so logins keep working across the deploy window.
 */
async function consumeJti(jti: string, exp: number | undefined): Promise<void> {
  const expiresAt = new Date(
    (typeof exp === "number" ? exp : Math.floor(Date.now() / 1000) + 120) * 1000,
  ).toISOString();

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("sso_consumed_jti")
    .insert({ jti, audience: AUDIENCE, expires_at: expiresAt });

  if (!error) return;
  if (error.code === "23505") {
    throw new Error("SSO token already used");
  }
  if (error.code === "42P01" || error.code === "PGRST205") {
    console.warn("[sso] sso_consumed_jti table missing; replay protection disabled");
    return;
  }
  throw new Error(`SSO jti check failed: ${error.message}`);
}
