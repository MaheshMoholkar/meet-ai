import { TRPCError } from "@trpc/server";
import { and, desc, eq, getTableColumns, ilike } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { containsPattern, pageOffset, paginationInput, totalPages } from "@/lib/pagination";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

import { agentsInsertSchema, agentsUpdateSchema } from "../schemas";

const agentWithMeetingCount = {
  ...getTableColumns(agents),
  meetingCount: db.$count(meetings, eq(meetings.agentId, agents.id)),
};

function notFound(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
}

export const agentsRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(z.object(paginationInput))
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search } = input;

      const where = and(
        eq(agents.userId, ctx.session.user.id),
        search ? ilike(agents.name, containsPattern(search)) : undefined,
      );

      const [items, total] = await Promise.all([
        db
          .select(agentWithMeetingCount)
          .from(agents)
          .where(where)
          .orderBy(desc(agents.createdAt), desc(agents.id))
          .limit(pageSize)
          .offset(pageOffset(page, pageSize)),
        db.$count(agents, where),
      ]);

      return { items, total, totalPages: totalPages(total, pageSize) };
    }),

  getOne: protectedProcedure.input(z.object({ id: z.uuid() })).query(async ({ ctx, input }) => {
    const [agent] = await db
      .select(agentWithMeetingCount)
      .from(agents)
      .where(and(eq(agents.id, input.id), eq(agents.userId, ctx.session.user.id)));

    return agent ?? notFound();
  }),

  create: protectedProcedure.input(agentsInsertSchema).mutation(async ({ ctx, input }) => {
    const [created] = await db
      .insert(agents)
      .values({ ...input, userId: ctx.session.user.id })
      .returning();

    return created;
  }),

  update: protectedProcedure.input(agentsUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...values } = input;

    const [updated] = await db
      .update(agents)
      .set(values)
      .where(and(eq(agents.id, id), eq(agents.userId, ctx.session.user.id)))
      .returning();

    return updated ?? notFound();
  }),

  remove: protectedProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
    const [removed] = await db
      .delete(agents)
      .where(and(eq(agents.id, input.id), eq(agents.userId, ctx.session.user.id)))
      .returning();

    return removed ?? notFound();
  }),
});
