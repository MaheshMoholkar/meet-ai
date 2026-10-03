import { describe, expect, it } from "vitest";

import { enabledSocialProviders, parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  LIVEKIT_URL: "http://localhost:7880",
  NEXT_PUBLIC_LIVEKIT_URL: "ws://localhost:7880",
  LIVEKIT_API_KEY: "devkey",
  LIVEKIT_API_SECRET: "y".repeat(32),
  S3_BUCKET: "meetai",
  SQS_QUEUE_URL: "http://localhost:4566/123456789012/meetai-summarize",
  LLM_BASE_URL: "http://localhost:11434/v1",
  LLM_MODEL: "qwen3.5:4b",
};

describe("parseEnv", () => {
  it("accepts a complete environment and treats empty optionals as unset", () => {
    const env = parseEnv({ ...valid, GITHUB_CLIENT_ID: "", GOOGLE_CLIENT_ID: "id" });
    expect(env.GITHUB_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_ID).toBe("id");
  });

  it("lists every invalid variable in one error", () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: "mysql://x", BETTER_AUTH_SECRET: "short" })).toThrow(
      /DATABASE_URL[\s\S]*BETTER_AUTH_SECRET|BETTER_AUTH_SECRET[\s\S]*DATABASE_URL/,
    );
  });

  it("applies defaults for call settings", () => {
    const env = parseEnv(valid);
    expect(env).toMatchObject({
      LIVEKIT_AGENT_NAME: "meet-agent",
      DAILY_BUDGET_MIN: 30,
      RECORDING_ENABLED: true,
      AWS_REGION: "us-east-1",
    });
    expect(parseEnv({ ...valid, DAILY_BUDGET_MIN: "5", RECORDING_ENABLED: "false" })).toMatchObject({
      DAILY_BUDGET_MIN: 5,
      RECORDING_ENABLED: false,
    });
  });

  it("requires a base URL for OpenAI-compatible LLMs but not for Bedrock", () => {
    expect(() => parseEnv({ ...valid, LLM_BASE_URL: "" })).toThrow(/LLM_BASE_URL/);
    expect(parseEnv({ ...valid, LLM_BASE_URL: "", LLM_PROVIDER: "bedrock" }).LLM_PROVIDER).toBe("bedrock");
  });

  it("enables a social provider only when id and secret are both set", () => {
    const env = parseEnv({
      ...valid,
      GITHUB_CLIENT_ID: "id",
      GITHUB_CLIENT_SECRET: "secret",
      GOOGLE_CLIENT_ID: "id",
    });
    expect(enabledSocialProviders(env)).toEqual(["github"]);
  });
});
