import { expect, test } from "@playwright/test";

import { seedMeeting, signUp } from "./helpers";

// Needs `make up` (LiveKit). The voice agent doesn't have to run: this covers the
// browser side of joining and leaving a call.
test("join a call through the lobby and leave it", async ({ page }) => {
  await signUp(page);

  await page.getByRole("link", { name: "Agents" }).click();
  await page.getByRole("button", { name: "New agent" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Coach");
  await dialog.getByLabel("Instructions").fill("Ask one question at a time.");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("link", { name: "Meetings" }).click();
  await page.getByRole("button", { name: "New meeting" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Interview practice");
  await dialog.getByLabel("Agent").click();
  await page.getByRole("option", { name: "Coach" }).click();
  await dialog.getByRole("button", { name: "Create", exact: true }).click();

  await page.getByRole("link", { name: "Start meeting" }).click();
  await expect(page).toHaveURL(/\/call\/[0-9a-f-]{36}$/);
  await expect(page.getByText("You'll talk with")).toBeVisible();

  await page.getByRole("button", { name: "Join call" }).click();
  await expect(page.getByRole("heading", { name: "Interview practice" })).toBeVisible();
  await expect(page.getByText(/Waiting for the agent|Agent is joining|Listening|Ready/)).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: /Leave/ }).click();
  await expect(page.getByRole("heading", { name: "You left the call" })).toBeVisible();
});

test("a finished meeting can't be joined again", async ({ page }) => {
  const { userId } = await signUp(page);
  const meetingId = await seedMeeting(userId, { name: "Done already", status: "completed", summary: "x" });

  await page.goto(`/call/${meetingId}`);

  await expect(page.getByText("This meeting has ended")).toBeVisible();
});
