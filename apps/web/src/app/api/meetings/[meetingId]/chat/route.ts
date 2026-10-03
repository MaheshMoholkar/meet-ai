import { createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { languageModel, languageModelOptions } from "@/lib/llm";
import {
  askInstructions,
  loadAskContext,
  recentMessages,
  saveMessage,
} from "@/modules/meetings/server/ask";

const bodySchema = z.object({ text: z.string().trim().min(1).max(2000) });

/** Ask AI: streams an answer about a completed meeting and stores both sides (spec §6.4). */
export async function POST(request: Request, { params }: RouteContext<"/api/meetings/[meetingId]/chat">) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { meetingId } = await params;
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(meetingId).success || !body.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const meeting = await loadAskContext(meetingId, session.user.id);
  if (!meeting) {
    return Response.json({ error: "Meeting not found" }, { status: 404 });
  }
  if (meeting.status !== "completed" || !meeting.summary) {
    return Response.json({ error: "This meeting doesn't have a summary yet" }, { status: 409 });
  }

  const history = await recentMessages(meetingId);
  await saveMessage(meetingId, "user", body.data.text);

  const result = streamText({
    model: languageModel(),
    instructions: askInstructions({ summary: meeting.summary, agentInstructions: meeting.agentInstructions }),
    messages: [...history, { role: "user", content: body.data.text }],
    providerOptions: languageModelOptions(),
    onEnd: async ({ text }) => {
      if (text.trim()) await saveMessage(meetingId, "assistant", text.trim());
    },
  });

  return createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) });
}
