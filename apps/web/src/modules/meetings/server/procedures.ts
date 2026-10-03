import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { PROCESSING_TIMEOUT_MINUTES } from "@/constants";
import { db } from "@/db";
import { agents, meetingDuration, meetingMessages, meetings } from "@/db/schema";
import { env } from "@/env";
import { presignedGetUrl } from "@/lib/aws";
import { createMeetingRoom, createParticipantToken } from "@/lib/livekit";
import { containsPattern, pageOffset, paginationInput, totalPages } from "@/lib/pagination";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

import { MEETING_STATUSES, meetingsInsertSchema, meetingsUpdateSchema } from "../schemas";
import { remainingBudgetSeconds } from "./budget";

// List rows leave out the transcript and summary, which can be large.
const meetingListColumns = {
  id: meetings.id,
  name: meetings.name,
  status: meetings.status,
  agentId: meetings.agentId,
  userId: meetings.userId,
  startedAt: meetings.startedAt,
  endedAt: meetings.endedAt,
  createdAt: meetings.createdAt,
  updatedAt: meetings.updatedAt,
  agent: { id: agents.id, name: agents.name },
  duration: meetingDuration,
};

function notFound(entity: "Meeting" | "Agent" = "Meeting"): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `${entity} not found` });
}

async function assertOwnsAgent(userId: string, agentId: string) {
  const owned = await db.$count(agents, and(eq(agents.id, agentId), eq(agents.userId, userId)));
  if (owned === 0) notFound("Agent");
}

/**
 * Lazy timeout (spec §5.4): a meeting left in `processing` past the timeout is
 * marked failed when its owner next reads meetings. No scheduler needed.
 */
export async function failStaleProcessing(userId: string) {
  await db
    .update(meetings)
    .set({ status: "failed" })
    .where(
      and(
        eq(meetings.userId, userId),
        eq(meetings.status, "processing"),
        lt(meetings.endedAt, sql`now() - make_interval(mins => ${PROCESSING_TIMEOUT_MINUTES})`),
      ),
    );
}

export const meetingsRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        ...paginationInput,
        status: z.enum(MEETING_STATUSES).nullish(),
        agentId: z.uuid().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, status, agentId } = input;
      const userId = ctx.session.user.id;

      await failStaleProcessing(userId);

      const where = and(
        eq(meetings.userId, userId),
        search ? ilike(meetings.name, containsPattern(search)) : undefined,
        status ? eq(meetings.status, status) : undefined,
        agentId ? eq(meetings.agentId, agentId) : undefined,
      );

      const [items, total] = await Promise.all([
        db
          .select(meetingListColumns)
          .from(meetings)
          .innerJoin(agents, eq(meetings.agentId, agents.id))
          .where(where)
          .orderBy(desc(meetings.createdAt), desc(meetings.id))
          .limit(pageSize)
          .offset(pageOffset(page, pageSize)),
        db.$count(meetings, where),
      ]);

      return { items, total, totalPages: totalPages(total, pageSize) };
    }),

  getOne: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    await failStaleProcessing(userId);

    const [meeting] = await db
      .select({
        ...meetingListColumns,
        summary: meetings.summary,
        recordingKey: meetings.recordingKey,
        agent: { id: agents.id, name: agents.name, instructions: agents.instructions },
      })
      .from(meetings)
      .innerJoin(agents, eq(meetings.agentId, agents.id))
      .where(and(eq(meetings.id, input.id), eq(meetings.userId, userId)));

    return meeting ?? notFound();
  }),

  /** Transcript items plus the names to show for each speaker. */
  getTranscript: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const [meeting] = await db
      .select({ transcript: meetings.transcript, agentName: agents.name })
      .from(meetings)
      .innerJoin(agents, eq(meetings.agentId, agents.id))
      .where(and(eq(meetings.id, input.id), eq(meetings.userId, ctx.session.user.id)));

    if (!meeting) notFound();

    return {
      items: meeting.transcript ?? [],
      names: { user: ctx.session.user.name, agent: meeting.agentName },
      userImage: ctx.session.user.image ?? null,
    };
  }),

  /** A 15-minute link to the audio recording, or null if there isn't one (spec §6.3). */
  getRecordingUrl: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const [meeting] = await db
      .select({ recordingKey: meetings.recordingKey })
      .from(meetings)
      .where(and(eq(meetings.id, input.id), eq(meetings.userId, ctx.session.user.id)));

    if (!meeting) notFound();
    return meeting.recordingKey ? presignedGetUrl(meeting.recordingKey) : null;
  }),

  /** Ask AI history, oldest first. */
  getMessages: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const owned = await db.$count(
      meetings,
      and(eq(meetings.id, input.id), eq(meetings.userId, ctx.session.user.id)),
    );
    if (owned === 0) notFound();

    return db
      .select({ id: meetingMessages.id, role: meetingMessages.role, content: meetingMessages.content })
      .from(meetingMessages)
      .where(eq(meetingMessages.meetingId, input.id))
      .orderBy(meetingMessages.createdAt, meetingMessages.id);
  }),

  create: protectedProcedure.input(meetingsInsertSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;

    await assertOwnsAgent(userId, input.agentId);

    const [created] = await db
      .insert(meetings)
      .values({ ...input, userId })
      .returning();

    return created;
  }),

  update: protectedProcedure.input(meetingsUpdateSchema).mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const { id, ...values } = input;

    await assertOwnsAgent(userId, values.agentId);

    const [updated] = await db
      .update(meetings)
      .set(values)
      .where(and(eq(meetings.id, id), eq(meetings.userId, userId)))
      .returning();

    return updated ?? notFound();
  }),

  /**
   * Starts (or rejoins) the call: creates the LiveKit room with the voice agent
   * dispatched and recording on, and returns a token for this user (spec §5.1).
   */
  join: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const { user } = ctx.session;

    const [meeting] = await db
      .select({
        id: meetings.id,
        status: meetings.status,
        agentName: agents.name,
        instructions: agents.instructions,
      })
      .from(meetings)
      .innerJoin(agents, eq(meetings.agentId, agents.id))
      .where(and(eq(meetings.id, input.id), eq(meetings.userId, user.id)));

    if (!meeting) notFound();

    if (meeting.status !== "upcoming" && meeting.status !== "active") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This meeting has already ended" });
    }

    const remainingSec = await remainingBudgetSeconds(env.DAILY_BUDGET_MIN);
    if (remainingSec <= 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Demo at capacity: today's call minutes are used up. Try again tomorrow.",
      });
    }

    try {
      await createMeetingRoom({
        meetingId: meeting.id,
        agentName: meeting.agentName,
        instructions: meeting.instructions,
        maxDurationSec: remainingSec,
      });
    } catch (cause) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Couldn't start the call. Please try again.",
        cause,
      });
    }

    const token = await createParticipantToken({ identity: user.id, name: user.name, room: meeting.id });
    return { token, serverUrl: env.LIVEKIT_PUBLIC_URL };
  }),

  remove: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const [removed] = await db
      .delete(meetings)
      .where(and(eq(meetings.id, input.id), eq(meetings.userId, ctx.session.user.id)))
      .returning();

    return removed ?? notFound();
  }),
});
