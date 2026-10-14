import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const publicPaths = ["/login", "/api/auth", "/sso/callback"];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Non-GET endpoints that are genuinely read-only and stay usable while an
// admin is viewing as another user.
const VIEW_AS_READONLY_POSTS = [
  "/api/quotes/preview", // renders a PDF from the posted pricing result; no writes
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const secureCookie = req.cookies.has("__Secure-authjs.session-token");
  const token = secureCookie
    ? req.cookies.get("__Secure-authjs.session-token")?.value
    : req.cookies.get("authjs.session-token")?.value;

  if (!token) {
    const callback = pathname === "/" ? "/calculator" : pathname;
    const signInUrl = new URL("/api/auth/signin/google", req.url);
    signInUrl.searchParams.set("callbackUrl", callback);
    return NextResponse.redirect(signInUrl);
  }

  // Admin "View as" sessions are read-only: refuse every mutation (API route
  // handlers and server actions alike — both arrive here as non-GET requests).
  if (!SAFE_METHODS.has(req.method) && !VIEW_AS_READONLY_POSTS.includes(pathname)) {
    const blocked = await viewAsBlock(req, secureCookie);
    if (blocked) return blocked;
  }

  return NextResponse.next();
}

async function viewAsBlock(req: NextRequest, secureCookie: boolean): Promise<NextResponse | null> {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null; // route-level viewAsWriteBlock() still applies
  try {
    const jwt = await getToken({ req, secret, secureCookie });
    if (!jwt?.viewAs) return null;
    const name = (typeof jwt.name === "string" && jwt.name) || jwt.email || "another user";
    return NextResponse.json({ error: `Read-only: viewing as ${name}` }, { status: 403 });
  } catch {
    return null;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
