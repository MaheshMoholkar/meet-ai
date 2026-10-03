import { describe, expect, it } from "vitest";

import { chunkLines, estimateTokens, formatTranscriptLine, parseTranscriptJsonl } from "./transcript";

describe("parseTranscriptJsonl", () => {
  it("parses lines, skips blank, malformed and empty-text lines, and sorts by start", () => {
    const jsonl = [
      JSON.stringify({ speaker: "agent", text: "Hi! How can I help?", startMs: 2000, endMs: 3500 }),
      "",
      JSON.stringify({ speaker: "user", text: "Hello", startMs: 500, endMs: 1200 }),
      JSON.stringify({ speaker: "user", text: "   ", startMs: 4000, endMs: 4100 }),
      JSON.stringify({ speaker: "robot", text: "??", startMs: 1, endMs: 2 }),
      '{"speaker":"user","text":"trunc',
    ].join("\n");

    expect(parseTranscriptJsonl(jsonl)).toEqual([
      { speaker: "user", text: "Hello", startMs: 500, endMs: 1200 },
      { speaker: "agent", text: "Hi! How can I help?", startMs: 2000, endMs: 3500 },
    ]);
  });
});

describe("formatTranscriptLine", () => {
  it("prefixes the timestamp and speaker name", () => {
    expect(
      formatTranscriptLine(
        { speaker: "agent", text: " Sure. ", startMs: 65_000, endMs: 66_000 },
        { user: "Ada", agent: "Tutor" },
      ),
    ).toBe("[01:05] Tutor: Sure.");
  });
});

describe("chunkLines", () => {
  it("keeps everything in one chunk when it fits", () => {
    expect(chunkLines(["a", "b", "c"], 100)).toEqual(["a\nb\nc"]);
  });

  it("splits only between lines and respects the budget", () => {
    const line = "x".repeat(40); // 10 tokens + 1 for the newline
    const chunks = chunkLines([line, line, line, line, line], 25);
    expect(chunks).toHaveLength(3);
    for (const chunk of chunks) expect(estimateTokens(chunk)).toBeLessThanOrEqual(25);
    expect(chunks.join("\n")).toBe([line, line, line, line, line].join("\n"));
  });

  it("puts a single over-long line in its own chunk", () => {
    const long = "y".repeat(400);
    expect(chunkLines(["short", long, "short"], 20)).toEqual(["short", long, "short"]);
  });
});
