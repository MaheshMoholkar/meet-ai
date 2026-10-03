import { z } from "zod";

export const MEETING_STATUSES = ["upcoming", "active", "processing", "completed", "failed"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const meetingsInsertSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  agentId: z.uuid("Agent is required"),
});

export const meetingsUpdateSchema = meetingsInsertSchema.extend({
  id: z.uuid(),
});

export type MeetingInsert = z.infer<typeof meetingsInsertSchema>;
