import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLauncherSsoToken } from "@/lib/sso/verifier";
import type { UserRole, Office, Department } from "@/types/auth";

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
      if (account?.provider === "credentials" && user.id === BOOTSTRAP_ADMIN_ID) return true;
      return isProfileAllowed(user.email);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.signedInAt = Date.now();
        token.checkedAt = Date.now();
        const adminEmail = bootstrapAdminEmail();
        if (adminEmail && user.email.toLowerCase() === adminEmail && user.id === BOOTSTRAP_ADMIN_ID) {
          token.role = "admin" as UserRole;
          token.profileId = BOOTSTRAP_ADMIN_ID;
          return token;
        }

        try {
          const supabase = createAdminClient();
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, role, office, department")
            .eq("email", user.email)
            .single();

          if (profile) {
            token.role = profile.role as UserRole;
            token.profileId = profile.id;
            if (profile.office) token.office = profile.office as Office;
            token.department = (profile.department ?? null) as Department | null;
          } else {
            token.role = "viewer" as UserRole;
          }
        } catch {
          token.role = "viewer" as UserRole;
        }
        return token;
      }
      return revalidateToken(token);
    },
    async session({ session, token }) {
      if (token) {
        session.user.role = token.role as UserRole;
        session.user.profileId = token.profileId as string;
        if (token.office) session.user.office = token.office as Office;
        session.user.department = (token.department ?? null) as Department | null;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // must stay <= 12h (audit policy)
  },
});

const REVALIDATE_INTERVAL_MS = 60 * 1000;

/** Sign-in gate: the profile must exist and be active. Fails open on DB errors. */
async function isProfileAllowed(email: string): Promise<boolean> {
  try {
    const { data: profile, error } = await createAdminClient()
      .from("profiles")
      .select("is_active")
      .eq("email", email)
      .maybeSingle();
    if (error) {
      console.warn("[auth] sign-in profile check failed; allowing", error.message);
      return true;
    }
    return !!profile && profile.is_active !== false;
  } catch (err) {
    console.warn("[auth] sign-in profile check threw; allowing", err);
    return true;
  }
}

/**
 * Session revocation: at most once a minute, re-read the caller's profile and
 * drop the session if the profile is gone, deactivated, or was force-signed-out
 * (launcher sets profiles.signed_out_at) after this session started. Role /
 * office / department are refreshed from the same row. DB errors fail open and
 * leave checkedAt untouched so the next request retries.
 */
async function revalidateToken(token: JWT): Promise<JWT | null> {
  const now = Date.now();
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
    const supabase = createAdminClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role, office, department, is_active, signed_out_at")
      .eq("email", token.email)
      .maybeSingle();
    if (error) {
      console.warn("[auth] profile revalidation failed; keeping session", error.message);
      return token;
    }
    if (!profile || profile.is_active === false) return null;
    if (profile.signed_out_at && new Date(profile.signed_out_at).getTime() > (token.signedInAt as number)) {
      return null;
    }

    token.role = profile.role as UserRole;
    token.profileId = profile.id;
    token.office = (profile.office ?? undefined) as Office | undefined;
    token.department = (profile.department ?? null) as Department | null;
    token.checkedAt = now;
    return token;
  } catch (err) {
    console.warn("[auth] profile revalidation threw; keeping session", err);
    return token;
  }
}
