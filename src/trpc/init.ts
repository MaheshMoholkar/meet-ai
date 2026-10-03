import { initTRPC, TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { cache } from "react";
import superjson from "superjson";

import { auth, type Session } from "@/lib/auth";

export type TRPCContext = {
  session: Session | null;
};

/** Loads the session once per request; every procedure reads it from context. */
export const createTRPCContext = cache(async (): Promise<TRPCContext> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return { session };
});

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
  }

  return next({ ctx: { session: ctx.session } });
});
