import { Suspense } from "react";
import { signInErrorMessage, signInErrorMessages } from "@/lib/launcher/sign-in-errors";
import { Callback } from "./callback";

export default function SsoCallbackPage() {
  return (
    <Suspense>
      <Callback messages={signInErrorMessages()} invalid={signInErrorMessage("SsoInvalid")!} />
    </Suspense>
  );
}
