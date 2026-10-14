import { Suspense } from "react";
import { signInErrorMessage } from "@/lib/launcher/sign-in-errors";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const errorMessage = signInErrorMessage(typeof error === "string" ? error : null);
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <Suspense>
        <LoginForm errorMessage={errorMessage} />
      </Suspense>
    </div>
  );
}
