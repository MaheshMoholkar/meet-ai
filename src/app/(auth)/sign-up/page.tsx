import type { Metadata } from "next";

import { enabledSocialProviders, env } from "@/env";
import { AuthView } from "@/modules/auth/ui/views/auth-view";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
  return <AuthView mode="sign-up" socialProviders={enabledSocialProviders(env)} />;
}
