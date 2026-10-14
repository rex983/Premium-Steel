import { signInErrorMessage as launcherSignInErrorMessage } from "@/lib/launcher-kit/sign-in-errors";

/** Pre-kit codes still accepted on the login page (old links / bookmarks). */
const LEGACY_CODES: Record<string, string> = {
  AccessCheckFailed: "LauncherUnavailable",
};

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
      return "Sign-in was denied.";
    default:
      return "Sign-in failed.";
  }
}
