"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { safeNext } from "@/lib/launcher-kit/urls";

/**
 * `messages` maps sign-in error codes to text and `invalid` is the expired /
 * used token message; both are built server-side (page.tsx) because the
 * kit's messages are server-only.
 */
export function Callback({
  messages,
  invalid,
}: {
  messages: Record<string, string>;
  invalid: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signInError, setSignInError] = useState<string | null>(null);
  // A missing token is known during render, so derive that error instead of
  // setting it from the effect.
  const hasToken = !!searchParams.get("sso_token");
  const error = hasToken ? signInError : invalid;

  useEffect(() => {
    const token = searchParams.get("sso_token");
    if (!token) return;
    (async () => {
      const res = await signIn("sso-jwt", {
        token,
        callbackUrl: safeNext(searchParams.get("next")) ?? "/calculator",
        redirect: false,
      });
      if (res?.ok && res.url) {
        router.replace(res.url);
      } else if (res?.error && res.error !== "CredentialsSignin") {
        setSignInError(messages[res.error] ?? messages.default);
      } else {
        setSignInError(invalid);
      }
    })();
  }, [router, searchParams, messages, invalid]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-2">
        {error ? (
          <>
            <p className="text-destructive font-medium">{error}</p>
            <a href="/login" className="text-sm text-muted-foreground underline">
              Go to login
            </a>
          </>
        ) : (
          <p className="text-muted-foreground">Signing you in…</p>
        )}
      </div>
    </div>
  );
}
