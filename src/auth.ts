import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { verifyLauncherToken, type LauncherActor } from "@/lib/launcher-kit/verifier";
import {
  launcherSignIn,
  recheckDue,
  recheckLauncherSession,
  type LauncherProfile,
  type SignInResult,
} from "@/lib/launcher-kit/session";
import type { UserRole, Office, Department, ViewAs } from "@/types/auth";

/**
 * Carried on the same user object from authorize() (act) and the signIn
 * callback (launcher result) to the jwt callback.
 */
type UserExtras = { act?: LauncherActor | null; launcher?: Extract<SignInResult, { ok: true }> };

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
        const claims = await verifyLauncherToken(token);
        return {
          id: claims.profile_id,
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
// live break-glass session within ~60s (see the jwt callback).
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
    // Sign-in gate for EVERY provider (sso-jwt, Google, break-glass password):
    // launcherSignIn() requires an active launcher profile and
    // launcher_can_open_app === true, and validates a View-as actor.
    // Break-glass additionally requires the profile to be a launcher admin.
    async signIn({ user, account }) {
      if (!user.email) return false;
      if (account?.provider === "google") {
        if (!user.email.endsWith("@bigbuildingsdirect.com")) return false;
      }

      const extras = user as UserExtras;
      const act = extras.act ?? null;
      if (act && account?.provider !== "sso-jwt") return false;

      const who =
        account?.provider === "sso-jwt" && user.id ? { id: user.id } : { email: user.email };
      const result = await launcherSignIn(who, act);
      if (!result.ok) return `/login?error=${result.error}`;
      if (account?.provider === "credentials" && result.profile.role !== "admin") return false;

      extras.launcher = result;
      return true;
    },
    async jwt({ token, user, account }) {
      if (user?.email) {
        const result = (user as UserExtras).launcher;
        if (!result) return null;
        const now = Date.now();
        token.signedInAt = now;
        token.checkedAt = now;
        token.accessOkAt = now; // signIn() just got "allowed" from the launcher
        token.breakGlass = account?.provider === "credentials";
        token.viewAs = result.viewAs;
        applyProfile(token, result.profile, result.permRole);
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

/** Copy the launcher-owned identity fields (and the resolved permission role) onto the token. */
function applyProfile(token: JWT, profile: LauncherProfile, permRole: string) {
  token.role = profile.role as UserRole;
  token.permRole = permRole as UserRole;
  token.profileId = profile.id;
  token.office = (profile.office ?? undefined) as Office | undefined;
  token.department = (profile.department ?? null) as Department | null;
  token.isIt = profile.is_it === true;
  if (profile.full_name) token.name = profile.full_name;
}

/**
 * The launcher kit's 60s recheck (profile, app access, View-as actor, grace
 * window) plus PSB's break-glass rules: the session dies as soon as the env
 * gate is removed or the profile stops being a launcher admin.
 */
async function revalidateToken(token: JWT): Promise<JWT | null> {
  const checkedAt = typeof token.checkedAt === "number" ? token.checkedAt : 0;
  if (!recheckDue(checkedAt)) return token;

  // Sessions minted before these fields existed: fall back to the JWT iat.
  if (typeof token.signedInAt !== "number") {
    token.signedInAt = typeof token.iat === "number" ? token.iat * 1000 : Date.now();
  }

  if (token.breakGlass) {
    const adminEmail = bootstrapAdminEmail();
    if (!adminEmail || (token.email ?? "").toLowerCase() !== adminEmail) return null;
  }

  if (!token.email || typeof token.profileId !== "string" || !token.profileId) return null;

  const result = await recheckLauncherSession({
    profileId: token.profileId,
    signedInAt: token.signedInAt as number,
    accessOkAt: typeof token.accessOkAt === "number" ? token.accessOkAt : null,
    role: typeof token.role === "string" ? token.role : null,
    permRole: typeof token.permRole === "string" ? token.permRole : null,
    viewAs: (token.viewAs as ViewAs | null | undefined) ?? null,
  });
  if (result.status === "keep") return token;
  if (result.status === "end") return null;

  if (token.breakGlass && result.profile.role !== "admin") return null;
  applyProfile(token, result.profile, result.permRole);
  token.checkedAt = result.now;
  token.accessOkAt = result.now;
  return token;
}
