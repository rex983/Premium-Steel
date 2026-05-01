import { createRemoteJWKSet, jwtVerify } from "jose";

// Public JWKS endpoint published by the BBD Launcher (its IdP).
// Override via LAUNCHER_JWKS_URL on Vercel if launcher moves.
const JWKS_URL =
  process.env.LAUNCHER_JWKS_URL ||
  "https://bbd-launcher.vercel.app/api/sso/jwks";

const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

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
    issuer: "bbd-launcher",
    audience: "psb-pricing",
  });

  if (typeof payload.email !== "string") {
    throw new Error("SSO token missing email claim");
  }

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
