import { describe, expect, it } from "vitest";

import { enabledSocialProviders, parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
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
