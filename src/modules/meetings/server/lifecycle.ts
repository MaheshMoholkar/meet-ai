import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { meetings } from "@/db/schema";

// Status transitions driven by LiveKit webhooks (spec §5.2). Each update only
// applies from the expected status, so duplicate or late events are no-ops.

/** The human joined: upcoming → active. */
export async function markActive(meetingId: string, at = new Date()) {
  const [row] = await db
    .update(meetings)
    .set({ status: "active", startedAt: at })
    .where(and(eq(meetings.id, meetingId), eq(meetings.status, "upcoming")))
    .returning({ id: meetings.id });
  return Boolean(row);
}

/** The room closed: active → processing. */
export async function markProcessing(meetingId: string, at = new Date()) {
  const [row] = await db
    .update(meetings)
    .set({ status: "processing", endedAt: at })
    .where(and(eq(meetings.id, meetingId), eq(meetings.status, "active")))
    .returning({ id: meetings.id });
  return Boolean(row);
}

/** The recording finished uploading. */
export async function setRecordingKey(meetingId: string, recordingKey: string) {
  const [row] = await db
    .update(meetings)
    .set({ recordingKey })
    .where(eq(meetings.id, meetingId))
    .returning({ id: meetings.id });
  return Boolean(row);
}
