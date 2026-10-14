import {
  SIGN_IN_ERROR_MESSAGES,
  signInErrorMessage as launcherSignInErrorMessage,
} from "@/lib/launcher-kit/sign-in-errors";

// Server-only (the kit's messages import its config / service-role client).
// Build messages in server components and pass the strings to client ones.

/** Pre-kit codes still accepted on the login page (old links / bookmarks). */
const LEGACY_CODES: Record<string, string> = {
  AccessCheckFailed: "LauncherUnavailable",
};

const DENIED = "Sign-in was denied.";
const FAILED = "Sign-in failed.";

/**
 * Message for a sign-in ?error= code: the launcher kit's codes first, then
 * NextAuth's own codes.
 */
export function signInErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  const kit = launcherSignInErrorMessage(LEGACY_CODES[code] ?? code);
  if (kit) return kit;
  switch (code) {
    case "AccessDenied":
    case "CredentialsSignin":
      return DENIED;
    default:
      return FAILED;
  }
}

/** Every known code's message (plus `default`), for client components. */
export function signInErrorMessages(): Record<string, string> {
  const legacy = Object.fromEntries(
    Object.entries(LEGACY_CODES).map(([old, code]) => [old, signInErrorMessage(code)!]),
  );
  return {
    ...SIGN_IN_ERROR_MESSAGES,
    ...legacy,
    AccessDenied: DENIED,
    CredentialsSignin: DENIED,
    default: FAILED,
  };
}
