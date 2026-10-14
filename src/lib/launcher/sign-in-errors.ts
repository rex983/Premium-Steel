/** Messages for the sign-in error codes returned by the auth signIn callback. */
export function signInErrorMessage(code: string | null | undefined): string | null {
  switch (code) {
    case "NoAppAccess":
      return "You don't have access to PSB Pricing in the launcher. Ask an admin to grant it in the BBD Launcher.";
    case "NoProfile":
      return "Your account isn't set up (or is inactive) in the BBD Launcher.";
    case "ViewAsDenied":
      return "View as is only available to active launcher admins.";
    case "AccessDenied":
    case "CredentialsSignin":
      return "Sign-in was denied.";
    default:
      return code ? "Sign-in failed." : null;
  }
}
