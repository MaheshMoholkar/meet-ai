"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { OctagonAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { GitHubIcon, GoogleIcon, Logo } from "@/components/icons";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 md:p-8" noValidate>
            <FieldGroup>
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">{isSignUp ? "Create an account" : "Welcome back"}</h1>
                <p className="text-balance text-muted-foreground">
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
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              ))}

              {error && (
                <Alert variant="destructive" className="border-none bg-destructive/10">
                  <OctagonAlertIcon />
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {isSignUp ? "Sign up" : "Sign in"}
              </Button>

              {socialProviders.length > 0 && (
                <>
                  <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                    <span className="relative z-10 bg-card px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {socialProviders.includes("google") && (
                      <Button
                        type="button"
                        variant="outline"
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
                        disabled={pending}
                        onClick={() => onSocial("github")}
                      >
                        <GitHubIcon /> GitHub
                      </Button>
                    )}
                  </div>
                </>
              )}

              <p className="text-center text-sm">
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
                <Link
                  href={isSignUp ? "/sign-in" : "/sign-up"}
                  className="underline underline-offset-4"
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </Link>
              </p>
            </FieldGroup>
          </form>

          <div className="relative hidden flex-col items-center justify-center gap-y-4 bg-radial from-sidebar-accent to-sidebar text-sidebar-foreground md:flex">
            <Logo className="size-20 text-sidebar-primary" />
            <p className="text-2xl font-semibold">Meet AI</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
