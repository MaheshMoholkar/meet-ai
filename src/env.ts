import { z } from "zod";

// Empty strings in .env files mean "not set".
const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const flag = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const schema = z.object({
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url(),
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,

  // Calls (sub-project 2)
  // Server-side API address (may be private), and the WebSocket URL browsers use.
  LIVEKIT_URL: z.url(),
  LIVEKIT_PUBLIC_URL: z.url(),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(32, "must be at least 32 characters"),
  LIVEKIT_AGENT_NAME: z.string().min(1).default("meet-agent"),
  DAILY_BUDGET_MIN: z.coerce.number().int().min(0).default(30),
  RECORDING_ENABLED: flag,

  // AWS (S3 + SQS). Endpoint and static keys are for the local emulator only;
  // in AWS the default credential chain (IAM role) is used.
  AWS_REGION: z.string().min(1).default("us-east-1"),
  AWS_ENDPOINT_URL: optional,
  AWS_ACCESS_KEY_ID: optional,
  AWS_SECRET_ACCESS_KEY: optional,
  S3_BUCKET: z.string().min(1),
  // Egress runs inside Docker and reaches the emulator by its service name.
  EGRESS_S3_ENDPOINT: optional,
  SQS_QUEUE_URL: z.url(),

  // Text LLM for summaries and Ask AI (sub-project 3).
  LLM_PROVIDER: z.enum(["openai_compatible", "bedrock"]).default("openai_compatible"),
  LLM_BASE_URL: optional,
  LLM_API_KEY: z.string().default("ollama"),
  LLM_MODEL: z.string().min(1),
  // "none" turns off qwen3.5's thinking on Ollama; leave unset for other models.
  LLM_REASONING_EFFORT: optional,
  LLM_MAX_INPUT_TOKENS: z.coerce.number().int().min(1000).default(6000),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  if (result.data.LLM_PROVIDER === "openai_compatible" && !result.data.LLM_BASE_URL) {
    throw new Error("Invalid environment variables:\n  LLM_BASE_URL: required when LLM_PROVIDER is openai_compatible");
  }

  return result.data;
}

export type SocialProvider = "github" | "google";

/** Providers whose client id and secret are both configured. */
export function enabledSocialProviders(config: Env): SocialProvider[] {
  const providers: SocialProvider[] = [];
  if (config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET) providers.push("github");
  if (config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET) providers.push("google");
  return providers;
}

// `next build` imports server modules while building the Docker image, where the
// real configuration doesn't exist yet. Validation still runs at server start.
export const env =
  process.env.SKIP_ENV_VALIDATION === "1" ? (process.env as unknown as Env) : parseEnv(process.env);
