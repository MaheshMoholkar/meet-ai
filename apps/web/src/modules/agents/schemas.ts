import { z } from "zod";

export const agentsInsertSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  instructions: z
    .string()
    .trim()
    .min(1, "Instructions are required")
    .max(4000, "Instructions are too long"),
});

export const agentsUpdateSchema = agentsInsertSchema.extend({
  id: z.uuid(),
});

export type AgentInsert = z.infer<typeof agentsInsertSchema>;
