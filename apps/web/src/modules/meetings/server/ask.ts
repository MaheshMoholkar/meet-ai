import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { agents, meetingMessages, meetings } from "@/db/schema";

export const ASK_HISTORY_LIMIT = 10;

/** System instructions for the post-call chat (ref's prompt, spec §6.4). */
export function askInstructions({ summary, agentInstructions }: { summary: string; agentInstructions: string }) {
  return `
You are an AI assistant helping the user revisit a recently completed meeting.
Below is a summary of the meeting, generated from the transcript:

${summary}

The following are your original instructions from the live meeting. Keep following these behavioral guidelines as you assist the user:

${agentInstructions}

The user may ask questions about the meeting, request clarifications, or ask for follow-up actions.
Always base your answers on the meeting summary above, and use the recent conversation for continuity.
If the summary doesn't contain enough information to answer, say so plainly.
Be concise, helpful and accurate.
`.trim();
}

/** The owner's completed meeting with what the chat needs, or null. */
export async function loadAskContext(meetingId: string, userId: string) {
  const [meeting] = await db
    .select({
      status: meetings.status,
      summary: meetings.summary,
      agentInstructions: agents.instructions,
    })
    .from(meetings)
    .innerJoin(agents, eq(meetings.agentId, agents.id))
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)));

  return meeting ?? null;
}

/** The latest messages, oldest first. */
export async function recentMessages(meetingId: string, limit = ASK_HISTORY_LIMIT) {
  const rows = await db
    .select({ role: meetingMessages.role, content: meetingMessages.content })
    .from(meetingMessages)
    .where(eq(meetingMessages.meetingId, meetingId))
    .orderBy(desc(meetingMessages.createdAt), desc(meetingMessages.id))
    .limit(limit);

  return rows.reverse();
}

export async function saveMessage(meetingId: string, role: "user" | "assistant", content: string) {
  await db.insert(meetingMessages).values({ meetingId, role, content });
}
