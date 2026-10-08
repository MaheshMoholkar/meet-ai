import { expect, test } from "@playwright/test";

import { signUp } from "./helpers";

test("signed-out visitors are sent to sign-in", async ({ page }) => {
  await page.goto("/meetings");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("sign-up validates the form before submitting", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page.getByText("Name is required")).toBeVisible();
  await expect(page.getByText("Enter a valid email")).toBeVisible();
});

test("agent and meeting lifecycle", async ({ page }) => {
  const { email } = await signUp(page);
  await expect(page.getByText("Create your first meeting")).toBeVisible();

  // Create an agent.
  await page.getByRole("link", { name: "Agents" }).click();
  await expect(page.getByText("Create your first agent")).toBeVisible();
  await page.getByRole("button", { name: "New agent" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Math tutor");
  await dialog.getByLabel("Instructions").fill("Explain step by step.");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("cell", { name: /Math tutor/ })).toBeVisible();

  // Create a meeting with it; the app opens the new meeting.
  await page.getByRole("link", { name: "Meetings" }).click();
  await page.getByRole("button", { name: "New meeting" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Algebra practice");
  await dialog.getByLabel("Agent").click();
  await page.getByRole("option", { name: "Math tutor" }).click();
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Not started yet")).toBeVisible();

  // Rename it.
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Geometry practice");
  await dialog.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Geometry practice");

  // It shows up in the list, and the status filter narrows it.
  await page.getByRole("link", { name: "My meetings" }).click();
  await expect(page.getByRole("cell", { name: /Geometry practice/ })).toBeVisible();
  await page.goto("/meetings?status=completed");
  await expect(page.getByText("No results")).toBeVisible();
  await page.goto("/meetings");

  // Delete it.
  await page.getByRole("cell", { name: /Geometry practice/ }).click();
  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete meeting" }).click();
  await expect(page).toHaveURL(/\/meetings$/);
  await expect(page.getByText("Create your first meeting")).toBeVisible();

  // Sign out, then back in.
  await page.getByRole("button", { name: /E2E User/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/meetings$/);
});
