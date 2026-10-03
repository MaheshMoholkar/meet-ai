import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Fake microphone/camera so calls can connect without prompts.
        launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
        permissions: ["microphone"],
      },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: `${baseURL}/sign-in`,
    timeout: 180_000,
    reuseExistingServer: false,
    // Process env wins over .env, so E2E runs against the test database.
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgres://meetai:meetai@localhost:5432/meetai_test",
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
    },
  },
});
