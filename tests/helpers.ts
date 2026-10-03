import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import type { Session } from "@/lib/auth";
import { createCallerFactory } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const createCaller = createCallerFactory(appRouter);

export async function resetDatabase() {
  await db.execute(sql`TRUNCATE TABLE "user" CASCADE`);
}

export async function createUser(name = "Test User") {
  const id = randomUUID();
  const [created] = await db
    .insert(user)
    .values({ id, name, email: `${id}@example.com` })
    .returning();
  return created;
}

type User = Awaited<ReturnType<typeof createUser>>;

/** A tRPC caller with a fake session for the given user, or none when signed out. */
export function callerFor(signedIn: User | null) {
  const session = signedIn
    ? ({
        user: signedIn,
        session: {
          id: randomUUID(),
          userId: signedIn.id,
          token: randomUUID(),
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as Session)
    : null;

  return createCaller({ session });
}

export async function insertAgent(userId: string, name = "Tutor") {
  const [created] = await db
    .insert(agents)
    .values({ userId, name, instructions: "Be helpful." })
    .returning();
  return created;
}

export async function insertMeeting(
  userId: string,
  agentId: string,
  values: Partial<typeof meetings.$inferInsert> = {},
) {
  const [created] = await db
    .insert(meetings)
    .values({ userId, agentId, name: "Weekly sync", ...values })
    .returning();
  return created;
}
