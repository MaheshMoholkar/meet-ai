"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { OctagonAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { GitHubIcon, GoogleIcon, LogoLockup } from "@/components/icons";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { VoiceBars } from "@/components/voice-bars";
import type { SocialProvider } from "@/env";
import { authClient } from "@/lib/auth-client";

const AFTER_AUTH_URL = "/meetings";

const signInSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.email("Enter a valid email"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type Values = z.infer<typeof signUpSchema>;

interface Props {
  mode: "sign-in" | "sign-up";
  socialProviders: SocialProvider[];
}

const fields = {
  "sign-in": ["email", "password"],
  "sign-up": ["name", "email", "password", "confirmPassword"],
} as const;

const fieldConfig: Record<keyof Values, { label: string; type: string; placeholder?: string }> = {
  name: { label: "Name", type: "text", placeholder: "Ada Lovelace" },
  email: { label: "Email", type: "email", placeholder: "ada@example.com" },
  password: { label: "Password", type: "password" },
  confirmPassword: { label: "Confirm password", type: "password" },
};

export function AuthView({ mode, socialProviders }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  const form = useForm<Values>({
    // Sign-in validates a subset of the sign-up fields.
    resolver: zodResolver(isSignUp ? signUpSchema : (signInSchema as unknown as typeof signUpSchema)),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const callbacks = {
    onRequest: () => {
      setError(null);
      setPending(true);
    },
    onSuccess: () => {
      router.push(AFTER_AUTH_URL);
      router.refresh();
    },
    onError: ({ error }: { error: { message?: string } }) => {
      setPending(false);
      setError(error.message ?? "Something went wrong");
    },
  };

  const onSubmit = (values: Values) => {
    if (isSignUp) {
      authClient.signUp.email(
        { name: values.name, email: values.email, password: values.password, callbackURL: AFTER_AUTH_URL },
        callbacks,
      );
    } else {
      authClient.signIn.email(
        { email: values.email, password: values.password, callbackURL: AFTER_AUTH_URL },
        callbacks,
      );
    }
  };

  const onSocial = (provider: SocialProvider) => {
    authClient.signIn.social(
      { provider, callbackURL: AFTER_AUTH_URL },
      { onRequest: callbacks.onRequest, onError: callbacks.onError },
    );
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-16">
        <div className="mx-auto w-full max-w-[360px]">
          <LogoLockup />
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-10" noValidate>
            <FieldGroup>
              <div>
                <h1 className="font-heading text-2xl leading-[30px] font-semibold tracking-[-0.015em]">
                  {isSignUp ? "Create an account" : "Welcome back"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isSignUp ? "Start talking to your own AI agents" : "Sign in to your account"}
                </p>
              </div>

              {fields[mode].map((name) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={name}>{fieldConfig[name].label}</FieldLabel>
                      <Input
                        {...field}
                        id={name}
                        type={fieldConfig[name].type}
                        placeholder={fieldConfig[name].placeholder}
                        autoComplete={name === "confirmPassword" ? "new-password" : name}
                        aria-invalid={fieldState.invalid}
                        className="h-10"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              ))}

              {error && (
                <Alert variant="destructive">
                  <OctagonAlertIcon />
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {isSignUp ? "Sign up" : "Sign in"}
              </Button>

              {socialProviders.length > 0 && (
                <>
                  <div className="flex items-center gap-x-3 text-[13px] leading-[18px] text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                    Or continue with
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {socialProviders.includes("google") && (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={pending}
                        onClick={() => onSocial("google")}
                      >
                        <GoogleIcon /> Google
                      </Button>
                    )}
                    {socialProviders.includes("github") && (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        disabled={pending}
                        onClick={() => onSocial("github")}
                      >
                        <GitHubIcon /> GitHub
                      </Button>
                    )}
                  </div>
                </>
              )}

              <p className="text-[13px] leading-[18px] text-muted-foreground">
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
                <Link
                  href={isSignUp ? "/sign-in" : "/sign-up"}
                  className="focus-ring rounded-sm text-agent-text underline underline-offset-4"
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </Link>
              </p>
            </FieldGroup>
          </form>
        </div>
      </div>

      {/* Night panel: one turn of conversation drawn in voice bars — you, the agent, you. */}
      <div className="dark relative hidden flex-col justify-end overflow-hidden bg-background p-16 lg:flex">
        <div aria-hidden="true" className="absolute inset-x-16 top-16 flex items-center justify-between">
          <VoiceBars speaker="you" levels={[0.3, 0.62, 0.44]} />
          <VoiceBars size="lg" speaker="agent" levels={[0.26, 0.5, 0.82, 1, 0.68, 0.4, 0.2]} />
          <VoiceBars speaker="you" levels={[0.5, 0.9, 0.7, 0.34]} />
        </div>
        <p className="font-heading text-[56px] leading-[56px] font-semibold tracking-[-0.03em]">Talk it through.</p>
        <p className="mt-4 max-w-[34ch] text-base leading-[26px] text-muted-foreground">
          Voice calls with AI agents you design. Hang up, and the transcript, the recording and a summary are
          waiting.
        </p>
      </div>
    </div>
  );
}
