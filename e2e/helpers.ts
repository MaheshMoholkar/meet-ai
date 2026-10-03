import { randomUUID } from "node:crypto";

import { expect, type Page } from "@playwright/test";
import { Pool } from "pg";

export const testDb = new Pool({
  connectionString: process.env.TEST_DATABASE_URL ?? "postgres://meetai:meetai@localhost:5432/meetai_test",
});

export async function signUp(page: Page, name = "E2E User") {
  const email = `e2e-${randomUUID()}@example.com`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
  await page.getByLabel("Confirm password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/meetings$/);

  const { rows } = await testDb.query<{ id: string }>(`SELECT id FROM "user" WHERE email = $1`, [email]);
  return { email, userId: rows[0].id };
}

export async function seedMeeting(
  userId: string,
  meeting: { name: string; status: string; summary?: string; transcript?: unknown[] },
) {
  const {
    rows: [agent],
  } = await testDb.query<{ id: string }>(
    `INSERT INTO agents (user_id, name, instructions) VALUES ($1, 'Math tutor', 'Explain patiently.') RETURNING id`,
    [userId],
  );
  const {
    rows: [row],
  } = await testDb.query<{ id: string }>(
    `INSERT INTO meetings (user_id, agent_id, name, status, summary, transcript, started_at, ended_at)
     VALUES ($1, $2, $3, $4, $5, $6, now() - interval '5 minutes', now()) RETURNING id`,
    [
      userId,
      agent.id,
      meeting.name,
      meeting.status,
      meeting.summary ?? null,
      meeting.transcript ? JSON.stringify(meeting.transcript) : null,
    ],
  );
  return row.id;
}
