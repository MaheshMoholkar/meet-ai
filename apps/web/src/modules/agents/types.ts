import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

type Outputs = inferRouterOutputs<AppRouter>["agents"];

export type AgentsGetMany = Outputs["getMany"]["items"];
export type AgentGetOne = Outputs["getOne"];
