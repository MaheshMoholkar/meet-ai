import { generateText } from "ai";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import { env } from "@/env";
import { readObjectText } from "@/lib/aws";
import { languageModel, languageModelOptions } from "@/lib/llm";

import {
  chunkLines,
  estimateTokens,
  formatTranscriptLine,
  parseTranscriptJsonl,
  type SpeakerNames,
} from "../transcript";
import type { TranscriptItem } from "@/db/schema";

export type Generate = (request: { instructions: string; prompt: string }) => Promise<string>;

const SUMMARY_INSTRUCTIONS = `
You are an expert summarizer. You write readable, concise, simple content.
You are given a meeting between a person and an AI agent. Summarize it.

Use this markdown structure for every output:

### Overview
A short narrative summary of the meeting in full sentences: what it was about, what was discussed, and any outcomes or takeaways.

### Notes
Key content broken into thematic sections, each with its timestamp range and bullet points. Example:

#### Section name (00:00–03:10)
- Main point discussed here
- Another key insight or question
`.trim();

const NOTES_INSTRUCTIONS = `
You are taking notes on one part of a longer meeting between a person and an AI agent.
Write concise bullet points grouped under "#### Section name (mm:ss–mm:ss)" headings.
Only include what appears in this part.
`.trim();

const REDUCE_INSTRUCTIONS = `${SUMMARY_INSTRUCTIONS}

You are given notes taken from consecutive parts of one meeting instead of the raw transcript.`;

const EMPTY_SUMMARY =
  "### Overview\nThe call ended before anything was said, so there is nothing to summarize.";

// Room for instructions and the model's answer inside the context window.
const RESERVED_TOKENS = 1500;

/**
 * Summarizes a transcript in one pass when it fits, otherwise map-reduce:
 * notes per chunk, then merged (spec §6.2). Same code for small and large models.
 */
export async function summarizeTranscript(
  items: TranscriptItem[],
  names: SpeakerNames,
  { generate, maxInputTokens }: { generate: Generate; maxInputTokens: number },
) {
  if (items.length === 0) return EMPTY_SUMMARY;

  const budget = Math.max(500, maxInputTokens - RESERVED_TOKENS);
  const lines = items.map((item) => formatTranscriptLine(item, names));
  const chunks = chunkLines(lines, budget);
  const heading = `A meeting between ${names.user} and the AI agent "${names.agent}".`;

  if (chunks.length === 1) {
    return generate({
      instructions: SUMMARY_INSTRUCTIONS,
      prompt: `${heading}\n\nTranscript:\n${chunks[0]}`,
    });
  }

  let notes: string[] = [];
  for (const [index, chunk] of chunks.entries()) {
    notes.push(
      await generate({
        instructions: NOTES_INSTRUCTIONS,
        prompt: `${heading} Part ${index + 1} of ${chunks.length}.\n\nTranscript:\n${chunk}`,
      }),
    );
  }

  // Notes from a very long call may themselves be too long: merge them in groups.
  for (let round = 0; estimateTokens(notes.join("\n\n")) > budget && round < 5; round++) {
    const groups = chunkLines(notes, budget);
    if (groups.length === notes.length) break; // each note alone exceeds the budget
    notes = await Promise.all(
      groups.map((group) =>
        generate({ instructions: NOTES_INSTRUCTIONS, prompt: `${heading}\n\nNotes to merge:\n${group}` }),
      ),
    );
  }

  return generate({
    instructions: REDUCE_INSTRUCTIONS,
    prompt: `${heading}\n\nNotes from consecutive parts of the meeting:\n\n${notes.join("\n\n")}`,
  });
}

export const generateWithLlm: Generate = async ({ instructions, prompt }) => {
  const { text } = await generateText({
    model: languageModel(),
    instructions,
    prompt,
    providerOptions: languageModelOptions(),
  });
  return text.trim();
};

export type ProcessResult = "completed" | "skipped" | "missing";

/**
 * Turns an uploaded transcript into a completed meeting (spec §6.2). Accepts
 * `active` too: the transcript can arrive before LiveKit's room_finished webhook.
 * Accepts `failed` so a late retry recovers a meeting the lazy timeout failed.
 */
export async function processMeeting(
  { meetingId, transcriptKey }: { meetingId: string; transcriptKey: string },
  deps: { readText: (key: string) => Promise<string>; generate: Generate; maxInputTokens: number } = {
    readText: readObjectText,
    generate: generateWithLlm,
    maxInputTokens: env.LLM_MAX_INPUT_TOKENS,
  },
): Promise<ProcessResult> {
  const [meeting] = await db
    .select({ status: meetings.status, userName: user.name, agentName: agents.name })
    .from(meetings)
    .innerJoin(user, eq(meetings.userId, user.id))
    .innerJoin(agents, eq(meetings.agentId, agents.id))
    .where(eq(meetings.id, meetingId));

  if (!meeting) return "missing";
  if (!["active", "processing", "failed"].includes(meeting.status)) return "skipped";

  const transcript = parseTranscriptJsonl(await deps.readText(transcriptKey));
  const summary = await summarizeTranscript(
    transcript,
    { user: meeting.userName, agent: meeting.agentName },
    deps,
  );

  const [updated] = await db
    .update(meetings)
    .set({
      transcript,
      summary,
      status: "completed",
      endedAt: sql`coalesce(${meetings.endedAt}, now())`,
    })
    .where(and(eq(meetings.id, meetingId), inArray(meetings.status, ["active", "processing", "failed"])))
    .returning({ id: meetings.id });

  return updated ? "completed" : "skipped";
}
