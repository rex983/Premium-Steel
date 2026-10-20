import { signInErrorMessages } from "@/lib/launcher/sign-in-errors";
import { LauncherSignInPage, type SignInSearchParams } from "@/lib/launcher-kit/sign-in-page";

// Signed-out visits go through the launcher: straight in when signed in there,
// otherwise one "Sign in on the launcher" button (launcher kit).
export default async function LoginPage({ searchParams }: { searchParams: Promise<SignInSearchParams> }) {
  return <LauncherSignInPage searchParams={await searchParams} messages={signInErrorMessages()} />;
}
