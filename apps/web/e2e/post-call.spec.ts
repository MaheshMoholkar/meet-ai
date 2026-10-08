import { expect, test } from "@playwright/test";

import { seedMeeting, signUp } from "./helpers";

const summary = `### Overview
The tutor walked the user through adding fractions with different denominators.

### Notes

#### Common denominators (00:00–00:30)
- One half plus one third is five sixths`;

const transcript = [
  { speaker: "user", text: "How do I add one half and one third?", startMs: 1000, endMs: 3000 },
  { speaker: "agent", text: "Find a common denominator first: six.", startMs: 4000, endMs: 7000 },
];

test("completed meeting shows summary, searchable transcript and recording state", async ({ page }) => {
  const { userId } = await signUp(page, "Ada Lovelace");
  const meetingId = await seedMeeting(userId, { name: "Fractions", status: "completed", summary, transcript });

  await page.goto(`/meetings/${meetingId}`);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("One half plus one third is five sixths")).toBeVisible();

  await page.getByRole("tab", { name: "Transcript" }).click();
  await expect(page.getByText("How do I add one half and one third?")).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Transcript" }).getByText("Ada Lovelace")).toBeVisible();
  await page.getByLabel("Search transcript").fill("denominator");
  await expect(page.getByText("How do I add one half")).toBeHidden();
  await expect(page.locator("mark", { hasText: "denominator" })).toBeVisible();

  // The recording is a strip above the tabs, not a tab of its own.
  await expect(page.getByRole("region", { name: "Recording" })).toContainText(/no recording for this meeting/);
});

test("Ask AI answers from the summary and keeps the history", async ({ page }) => {
  const llm = process.env.LLM_BASE_URL ?? "http://localhost:11434/v1";
  const reachable = await fetch(`${llm}/models`, { signal: AbortSignal.timeout(3000) })
    .then((response) => response.ok)
    .catch(() => false);
  test.skip(!reachable, `No LLM at ${llm}`);
  test.setTimeout(120_000);

  const { userId } = await signUp(page);
  const meetingId = await seedMeeting(userId, { name: "Fractions", status: "completed", summary, transcript });

  await page.goto(`/meetings/${meetingId}`);
  await page.getByRole("tab", { name: "Ask AI" }).click();
  await page.getByLabel("Ask a question about this meeting").fill("What is one half plus one third? Reply with just the fraction.");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText(/5\/6|five sixths|five-sixths/i).last()).toBeVisible({ timeout: 90_000 });

  // The conversation survives a reload (stored server-side).
  await page.reload();
  await page.getByRole("tab", { name: "Ask AI" }).click();
  await expect(page.getByText("What is one half plus one third?")).toBeVisible();
});
