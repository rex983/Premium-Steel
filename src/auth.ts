import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLauncherSsoToken, type LauncherSsoActor } from "@/lib/sso/verifier";
import { checkLauncherAccess, launcherPermissionRole } from "@/lib/launcher/access";
import { VIEW_AS_MAX_MS } from "@/lib/session/view-as-config";
import type { UserRole, Office, Department, ViewAs } from "@/types/auth";

/** Carried from authorize() to the signIn/jwt callbacks on the same user object. */
type SsoUserExtras = { act?: LauncherSsoActor | null };

const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          hd: "bigbuildingsdirect.com",
          prompt: "select_account",
        },
      },
    })
  );
}

providers.push(
  Credentials({
    id: "sso-jwt",
    name: "Launcher SSO",
    credentials: {
      token: { label: "SSO Token", type: "text" },
    },
    async authorize(credentials) {
      const token = typeof credentials?.token === "string" ? credentials.token : "";
      if (!token) return null;
      try {
        const claims = await verifyLauncherSsoToken(token);
        return {
          id: claims.profile_id || claims.sub,
          email: claims.email,
          name: claims.name || null,
          image: null,
          act: claims.act,
        };
      } catch (err) {
        console.error("[auth] launcher SSO token verification failed", err);
        return null;
      }
    },
  })
);

// Break-glass password login. Disabled unless BOTH BOOTSTRAP_ADMIN_EMAIL and
// ADMIN_PASSWORD (min 8 chars) are set; password is checked with a
// constant-time compare. It only AUTHENTICATES: the email must still be an
// active launcher admin profile and launcher_can_open_app must return true,
// exactly like every other provider. Unset BOOTSTRAP_ADMIN_EMAIL to revoke any
// live break-glass session within ~60s (see revalidateToken).
function bootstrapAdminEmail(): string | null {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").trim().toLowerCase();
  const pw = (process.env.ADMIN_PASSWORD || "").trim();
  return email && pw.length >= 8 ? email : null;
}

if (bootstrapAdminEmail()) {
  providers.push(
    Credentials({
      id: "credentials",
      name: "Admin Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const adminEmail = bootstrapAdminEmail();
        if (!adminEmail || !email || !password) return null;

        const adminPw = (process.env.ADMIN_PASSWORD || "").trim();
        if (email === adminEmail && constantTimeEqual(password, adminPw)) {
          return { id: email, email, name: null, image: null };
        }
        // Everyone else must authenticate via Google or the launcher SSO token.
        return null;
      },
    })
  );
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      if (account?.provider === "google") {
        if (!user.email.endsWith("@bigbuildingsdirect.com")) return false;
      }

      const gate = await signInGate(user.email, account?.provider === "credentials");
      if (gate !== true) return gate;

      const act = (user as SsoUserExtras).act;
      if (act) {
        if (account?.provider !== "sso-jwt") return false;
        if ((await isActorStillAdmin(act.profile_id, act.sub)) !== true) {
          return "/login?error=ViewAsDenied";
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user?.email) {
        const now = Date.now();
        token.signedInAt = now;
        token.checkedAt = now;
        token.accessOkAt = now; // signIn() just got "granted" from the launcher
        token.viewAs = null;
        token.breakGlass = account?.provider === "credentials";

        // signIn() already required an active launcher profiles row; load the
        // shared identity from it. No row -> no session (no fallback role).
        const { data: profile } = await createAdminClient()
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .eq("email", user.email)
          .maybeSingle();
        if (!profile) return null;
        const row = profile as ProfileRow;
        applyProfile(token, row, await launcherPermissionRole(row.role));

        const act = (user as SsoUserExtras).act;
        if (act) {
          const viewAs: ViewAs = {
            actorProfileId: act.profile_id,
            actorEmail: act.sub,
            actorName: act.name || null,
            startedAt: now,
          };
          token.viewAs = viewAs;
        }
        return token;
      }
      return revalidateToken(token);
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role as UserRole;
        session.user.permRole = (token.permRole ?? "") as UserRole;
        session.user.profileId = token.profileId as string;
        session.user.office = (token.office ?? undefined) as Office | undefined;
        session.user.department = (token.department ?? null) as Department | null;
        session.user.isIt = token.isIt === true;
        if (typeof token.name === "string") session.user.name = token.name;
      }
      session.viewAs = (token?.viewAs as ViewAs | null | undefined) ?? null;
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // must stay <= 12h (audit policy)
  },
});

const REVALIDATE_INTERVAL_MS = 60 * 1000;
/** RPC missing / transient errors are tolerated this long after the last successful access check. */
const ACCESS_ERROR_GRACE_MS = 5 * 60 * 1000;
const PROFILE_COLUMNS =
  "id, email, full_name, role, office, department, is_it, is_active, signed_out_at";

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  office: string | null;
  department: string | null;
  is_it: boolean | null;
  is_active: boolean | null;
  signed_out_at: string | null;
}

/** Copy the launcher-owned identity fields (and the resolved permission role) onto the token. */
function applyProfile(token: JWT, profile: ProfileRow, permRole: string) {
  token.role = profile.role as UserRole;
  token.permRole = permRole as UserRole;
  token.profileId = profile.id;
  token.office = (profile.office ?? undefined) as Office | undefined;
  token.department = (profile.department ?? null) as Department | null;
  token.isIt = profile.is_it === true;
  if (profile.full_name) token.name = profile.full_name;
}

/**
 * Sign-in gate for EVERY provider (sso-jwt, Google, break-glass password):
 * an active launcher profiles row and launcher_can_open_app === true.
 * Anything else (false, unregistered app, RPC missing, DB error) denies.
 * Break-glass additionally requires the profile to be a launcher admin.
 */
async function signInGate(email: string, breakGlass: boolean): Promise<true | false | string> {
  try {
    const { data: profile, error } = await createAdminClient()
      .from("profiles")
      .select("id, role, is_active")
      .eq("email", email)
      .maybeSingle();
    if (error) {
      console.warn("[auth] sign-in profile check failed; denying", error.message);
      return "/login?error=AccessCheckFailed";
    }
    if (!profile || profile.is_active === false) return "/login?error=NoProfile";
    if (breakGlass && profile.role !== "admin") return false;
    const access = await checkLauncherAccess(profile.id);
    if (access === "error") return "/login?error=AccessCheckFailed";
    if (access !== "granted") return "/login?error=NoAppAccess";
    return true;
  } catch (err) {
    console.warn("[auth] sign-in profile check threw; denying", err);
    return "/login?error=AccessCheckFailed";
  }
}

/**
 * The View-as actor must still be an active launcher admin (and, at sign-in,
 * match the email in the act claim). Returns null on a transient DB error.
 */
async function isActorStillAdmin(actorProfileId: string, actorEmail?: string): Promise<boolean | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("profiles")
      .select("email, role, is_active")
      .eq("id", actorProfileId)
      .maybeSingle();
    if (error) return null;
    if (!data || data.is_active === false || data.role !== "admin") return false;
    if (actorEmail && (data.email ?? "").toLowerCase() !== actorEmail.toLowerCase()) return false;
    return true;
  } catch {
    return null;
  }
}

/**
 * Session revocation + live sync with the launcher: at most once a minute,
 * re-read the caller's profile, launcher app access and the View-as actor (in
 * parallel) and drop the session if the profile is gone, deactivated,
 * force-signed-out (profiles.signed_out_at after this session started), or the
 * launcher no longer grants this app (false or unregistered). If the access
 * check itself errors, the session survives only until 5 minutes after the
 * last successful check. Role / permission role / office / department / is_it
 * / name are refreshed so launcher edits apply within ~60s without re-login. A
 * View-as session also needs the actor to still be an active admin and ends 60
 * minutes after it started.
 */
async function revalidateToken(token: JWT): Promise<JWT | null> {
  const now = Date.now();
  const viewAs = token.viewAs as ViewAs | null | undefined;
  if (viewAs && now - viewAs.startedAt > VIEW_AS_MAX_MS) return null;

  const checkedAt = typeof token.checkedAt === "number" ? token.checkedAt : 0;
  if (now - checkedAt < REVALIDATE_INTERVAL_MS) return token;

  // Sessions minted before these fields existed: fall back to the JWT iat.
  if (typeof token.signedInAt !== "number") {
    token.signedInAt = typeof token.iat === "number" ? token.iat * 1000 : now;
  }
  const accessOkAt = typeof token.accessOkAt === "number" ? token.accessOkAt : (token.signedInAt as number);

  // Break-glass sessions die as soon as the env gate is removed.
  if (token.breakGlass) {
    const adminEmail = bootstrapAdminEmail();
    if (!adminEmail || (token.email ?? "").toLowerCase() !== adminEmail) return null;
  }

  if (!token.email || typeof token.profileId !== "string" || !token.profileId) return null;

  try {
    const prevRole = typeof token.role === "string" ? token.role : "";
    const [{ data: profile, error }, access, actorOk, prevPermRole] = await Promise.all([
      createAdminClient().from("profiles").select(PROFILE_COLUMNS).eq("email", token.email).maybeSingle(),
      checkLauncherAccess(token.profileId),
      viewAs ? isActorStillAdmin(viewAs.actorProfileId) : Promise.resolve(true as boolean | null),
      launcherPermissionRole(prevRole),
    ]);

    if (access === "denied") return null;
    if (access === "granted") token.accessOkAt = now;
    else if (now - accessOkAt > ACCESS_ERROR_GRACE_MS) return null;

    if (error) {
      console.warn("[auth] profile revalidation failed; keeping session", error.message);
      return token;
    }
    const row = profile as ProfileRow | null;
    if (!row || row.is_active === false) return null;
    if (row.id !== token.profileId) return null;
    if (row.signed_out_at && new Date(row.signed_out_at).getTime() > (token.signedInAt as number)) {
      return null;
    }
    if (token.breakGlass && row.role !== "admin") return null;
    if (actorOk === false) return null;

    const permRole = row.role === prevRole ? prevPermRole : await launcherPermissionRole(row.role);
    applyProfile(token, row, permRole);
    // Access or actor lookup failed transiently: retry on the next request.
    if (access === "granted" && actorOk !== null) token.checkedAt = now;
    return token;
  } catch (err) {
    console.warn("[auth] profile revalidation threw; keeping session", err);
    return now - accessOkAt > ACCESS_ERROR_GRACE_MS ? null : token;
  }
}
