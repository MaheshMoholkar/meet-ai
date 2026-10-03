import { and, gte, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { meetings } from "@/db/schema";

/** Midnight UTC of the given instant's day. */
export function startOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Seconds of calls started today (UTC), across all users. A call still in
 * progress counts up to `now` (spec §5.1).
 */
export async function secondsUsedToday(now = new Date()) {
  const [row] = await db
    .select({
      seconds: sql<number>`coalesce(sum(extract(epoch from (coalesce(${meetings.endedAt}, ${now.toISOString()}::timestamp) - ${meetings.startedAt}))), 0)::float8`,
    })
    .from(meetings)
    .where(and(isNotNull(meetings.startedAt), gte(meetings.startedAt, startOfUtcDay(now))));

  return Math.max(0, row?.seconds ?? 0);
}

/** Whole seconds of call time left today under the global daily budget. */
export async function remainingBudgetSeconds(dailyBudgetMinutes: number, now = new Date()) {
  const used = await secondsUsedToday(now);
  return Math.max(0, Math.floor(dailyBudgetMinutes * 60 - used));
}
