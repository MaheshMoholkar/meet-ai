import { z } from "zod";

import type { TranscriptItem } from "@/db/schema";
import { formatTimestamp } from "@/lib/utils";

const transcriptItemSchema = z.object({
  speaker: z.enum(["user", "agent"]),
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
});

/** Parses the agent's JSONL transcript, skipping blank and malformed lines. */
export function parseTranscriptJsonl(jsonl: string): TranscriptItem[] {
  const items: TranscriptItem[] = [];

  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = transcriptItemSchema.safeParse(JSON.parse(line));
      if (parsed.success && parsed.data.text.trim()) items.push(parsed.data);
    } catch {
      // A truncated last line from an interrupted upload: ignore it.
    }
  }

  return items.sort((a, b) => a.startMs - b.startMs);
}

export interface SpeakerNames {
  user: string;
  agent: string;
}

/** "[01:05] Ada: Hello there" */
export function formatTranscriptLine(item: TranscriptItem, names: SpeakerNames) {
  return `[${formatTimestamp(item.startMs)}] ${names[item.speaker]}: ${item.text.trim()}`;
}

/** Rough token estimate: about four characters per token for English. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

/**
 * Splits transcript lines into chunks of at most `maxTokens`, only ever
 * breaking between utterances. A single over-long utterance becomes its own chunk.
 */
export function chunkLines(lines: string[], maxTokens: number): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const line of lines) {
    const tokens = estimateTokens(line) + 1;
    if (current.length > 0 && currentTokens + tokens > maxTokens) {
      chunks.push(current.join("\n"));
      current = [];
      currentTokens = 0;
    }
    current.push(line);
    currentTokens += tokens;
  }

  if (current.length > 0) chunks.push(current.join("\n"));
  return chunks;
}
