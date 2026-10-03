import type { Metadata } from "next";

import { enabledSocialProviders, env } from "@/env";
import { AuthView } from "@/modules/auth/ui/views/auth-view";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return <AuthView mode="sign-in" socialProviders={enabledSocialProviders(env)} />;
}
