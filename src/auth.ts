import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLauncherSsoToken, type LauncherSsoActor } from "@/lib/sso/verifier";
import { launcherCanOpenApp } from "@/lib/launcher/access";
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

// Break-glass admin login (no profiles row). Disabled unless BOTH
// BOOTSTRAP_ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) are set; password is
// checked with a constant-time compare. Unset BOOTSTRAP_ADMIN_EMAIL to revoke
// any live bootstrap session within ~60s (see revalidateToken).
const BOOTSTRAP_ADMIN_ID = "admin-001";

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
          return { id: BOOTSTRAP_ADMIN_ID, email, name: "Bootstrap Admin", image: null };
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
      // Break-glass admin (documented exception: role=admin only, no launcher row).
      if (account?.provider === "credentials" && user.id === BOOTSTRAP_ADMIN_ID) return true;

      const gate = await signInGate(user.email);
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
    async jwt({ token, user }) {
      if (user?.email) {
        token.signedInAt = Date.now();
        token.checkedAt = Date.now();
        token.viewAs = null;
        const adminEmail = bootstrapAdminEmail();
        if (adminEmail && user.email.toLowerCase() === adminEmail && user.id === BOOTSTRAP_ADMIN_ID) {
          token.role = "admin" as UserRole;
          token.profileId = BOOTSTRAP_ADMIN_ID;
          return token;
        }

        // signIn() already required an active launcher profiles row; load the
        // shared identity from it. No row -> no session (no fallback role).
        const { data: profile } = await createAdminClient()
          .from("profiles")
          .select(PROFILE_COLUMNS)
          .eq("email", user.email)
          .maybeSingle();
        if (!profile) return null;
        applyProfile(token, profile as ProfileRow);

        const act = (user as SsoUserExtras).act;
        if (act) {
          const viewAs: ViewAs = {
            actorProfileId: act.profile_id,
            actorEmail: act.sub,
            actorName: act.name || null,
            startedAt: Date.now(),
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

/** Copy the launcher-owned identity fields onto the token. */
function applyProfile(token: JWT, profile: ProfileRow) {
  token.role = profile.role as UserRole;
  token.profileId = profile.id;
  token.office = (profile.office ?? undefined) as Office | undefined;
  token.department = (profile.department ?? null) as Department | null;
  token.isIt = profile.is_it === true;
  if (profile.full_name) token.name = profile.full_name;
}

/**
 * Sign-in gate (every provider except break-glass): the launcher profiles row
 * must exist and be active, and the launcher must grant access to this app.
 * A profile read error denies (no role can be established without it); the
 * launcher access RPC itself fails open (see launcherCanOpenApp).
 */
async function signInGate(email: string): Promise<true | false | string> {
  try {
    const { data: profile, error } = await createAdminClient()
      .from("profiles")
      .select("id, is_active")
      .eq("email", email)
      .maybeSingle();
    if (error) {
      console.warn("[auth] sign-in profile check failed; denying", error.message);
      return false;
    }
    if (!profile || profile.is_active === false) return "/login?error=NoProfile";
    if (!(await launcherCanOpenApp(profile.id))) return "/login?error=NoAppAccess";
    return true;
  } catch (err) {
    console.warn("[auth] sign-in profile check threw; denying", err);
    return false;
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
 * re-read the caller's profile and launcher app access (in parallel) and drop
 * the session if the profile is gone, deactivated, force-signed-out
 * (profiles.signed_out_at after this session started), or no longer granted
 * this app. Role / office / department / is_it / name are refreshed from the
 * same row so launcher edits apply within ~60s without re-login. A View-as
 * session also needs the actor to still be an active admin and ends 60 minutes
 * after it started. DB errors fail open and leave checkedAt untouched so the
 * next request retries.
 */
async function revalidateToken(token: JWT): Promise<JWT | null> {
  const now = Date.now();
  const viewAs = token.viewAs as ViewAs | null | undefined;
  if (viewAs && now - viewAs.startedAt > VIEW_AS_MAX_MS) return null;

  const checkedAt = typeof token.checkedAt === "number" ? token.checkedAt : 0;
  if (now - checkedAt < REVALIDATE_INTERVAL_MS) return token;

  // Sessions minted before this check existed carry no signedInAt; fall back
  // to the JWT iat (seconds) the first time we see them.
  if (typeof token.signedInAt !== "number") {
    token.signedInAt = typeof token.iat === "number" ? token.iat * 1000 : now;
  }

  if (token.profileId === BOOTSTRAP_ADMIN_ID) {
    const adminEmail = bootstrapAdminEmail();
    if (!adminEmail || (token.email ?? "").toLowerCase() !== adminEmail) return null;
    token.checkedAt = now;
    return token;
  }

  if (!token.email) return null;

  try {
    const profileQuery = createAdminClient()
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("email", token.email)
      .maybeSingle();
    const [{ data: profile, error }, hasAccess, actorOk] = await Promise.all([
      profileQuery,
      typeof token.profileId === "string" && token.profileId
        ? launcherCanOpenApp(token.profileId)
        : Promise.resolve(true),
      viewAs ? isActorStillAdmin(viewAs.actorProfileId) : Promise.resolve(true as boolean | null),
    ]);
    if (error) {
      console.warn("[auth] profile revalidation failed; keeping session", error.message);
      return token;
    }
    const row = profile as ProfileRow | null;
    if (!row || row.is_active === false) return null;
    if (row.signed_out_at && new Date(row.signed_out_at).getTime() > (token.signedInAt as number)) {
      return null;
    }
    if (!hasAccess) return null;
    if (actorOk === false) return null;

    applyProfile(token, row);
    // Actor lookup failed transiently: keep the session but retry next request.
    if (actorOk !== null) token.checkedAt = now;
    return token;
  } catch (err) {
    console.warn("[auth] profile revalidation threw; keeping session", err);
    return token;
  }
}
