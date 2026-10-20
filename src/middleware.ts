import { NextRequest, NextResponse } from "next/server";
import { viewAsWriteBlock } from "@/lib/launcher-kit/view-as";

const publicPaths = ["/login", "/api/auth", "/sso/callback"];

// Non-GET endpoints that stay usable while an admin is viewing as another
// user (/api/auth so sign-out works; the rest are genuinely read-only).
const VIEW_AS_ALLOW = [
  "/api/auth",
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
    // /login sends them through the launcher: straight in when they're signed in there.
    const signInUrl = new URL("/login", req.url);
    signInUrl.searchParams.set("callbackUrl", callback);
    return NextResponse.redirect(signInUrl);
  }

  // Admin "View as" sessions are read-only: refuse every mutation (API route
  // handlers and server actions alike — both arrive here as non-GET requests).
  // Route-level rejectIfViewingAs() is the second layer.
  const blocked = await viewAsWriteBlock(req, VIEW_AS_ALLOW);
  if (blocked) return blocked;

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
