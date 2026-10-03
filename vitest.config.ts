import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the process environment.
}

// Tests never touch the dev database.
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgres://meetai:meetai@localhost:5432/meetai_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    env: { DATABASE_URL: testDatabaseUrl, DAILY_BUDGET_MIN: "30" },
    // Integration tests share one database.
    fileParallelism: false,
  },
});
