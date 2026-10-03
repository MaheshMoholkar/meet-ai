import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type Outputs = inferRouterOutputs<AppRouter>["meetings"];

export type MeetingsGetMany = Outputs["getMany"]["items"];
export type MeetingGetOne = Outputs["getOne"];
