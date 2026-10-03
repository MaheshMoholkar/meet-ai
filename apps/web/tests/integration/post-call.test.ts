import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TranscriptItem } from "@/db/schema";
import { recentMessages, saveMessage } from "@/modules/meetings/server/ask";
import { processMeeting, summarizeTranscript, type Generate } from "@/modules/meetings/server/summarize";

import { callerFor, createUser, insertAgent, insertMeeting, resetDatabase } from "../helpers";

beforeEach(resetDatabase);

const item = (speaker: TranscriptItem["speaker"], text: string, startMs: number): TranscriptItem => ({
  speaker,
  text,
  startMs,
  endMs: startMs + 1000,
});

const jsonl = (items: TranscriptItem[]) => items.map((i) => JSON.stringify(i)).join("\n");
const names = { user: "Ada", agent: "Tutor" };

describe("summarizeTranscript", () => {
  it("summarizes a short transcript in one pass", async () => {
    const generate = vi.fn<Generate>(async () => "### Overview\nShort call.");

    const summary = await summarizeTranscript([item("user", "Hi", 0), item("agent", "Hello", 1000)], names, {
      generate,
      maxInputTokens: 6000,
    });

    expect(summary).toBe("### Overview\nShort call.");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0].prompt).toContain("[00:00] Ada: Hi");
    expect(generate.mock.calls[0][0].prompt).toContain("[00:01] Tutor: Hello");
  });

  it("maps chunks to notes, then reduces, when the transcript is too long", async () => {
    const generate = vi.fn<Generate>(async ({ prompt }) =>
      prompt.includes("Notes from consecutive parts") ? "FINAL" : "#### Notes\n- point",
    );
    // ~300 tokens per line against a ~500-token chunk budget.
    const items = Array.from({ length: 6 }, (_, i) => item("user", "word ".repeat(240), i * 60_000));

    const summary = await summarizeTranscript(items, names, { generate, maxInputTokens: 2000 });

    expect(summary).toBe("FINAL");
    const notesCalls = generate.mock.calls.filter(([request]) => request.prompt.includes("Part "));
    expect(notesCalls.length).toBeGreaterThan(1);
    expect(generate.mock.calls.at(-1)?.[0].prompt).toContain("Notes from consecutive parts");
  });

  it("doesn't call the model for an empty transcript", async () => {
    const generate = vi.fn<Generate>();
    const summary = await summarizeTranscript([], names, { generate, maxInputTokens: 6000 });
    expect(summary).toContain("nothing to summarize");
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("processMeeting", () => {
  const deps = (transcript: TranscriptItem[]) => ({
    readText: vi.fn(async () => jsonl(transcript)),
    generate: vi.fn<Generate>(async () => "### Overview\nDone."),
    maxInputTokens: 6000,
  });

  it("stores the transcript and summary and completes a processing meeting", async () => {
    const ada = await createUser("Ada");
    const agent = await insertAgent(ada.id, "Tutor");
    const meeting = await insertMeeting(ada.id, agent.id, {
      status: "processing",
      startedAt: new Date(Date.now() - 120_000),
      endedAt: new Date(),
    });
    const transcript = [item("user", "What is 2+2?", 0), item("agent", "Four.", 1500)];
    const d = deps(transcript);

    const result = await processMeeting({ meetingId: meeting.id, transcriptKey: "transcripts/x.jsonl" }, d);

    expect(result).toBe("completed");
    expect(d.readText).toHaveBeenCalledWith("transcripts/x.jsonl");
    const api = callerFor(ada);
    const done = await api.meetings.getOne({ id: meeting.id });
    expect(done).toMatchObject({ status: "completed", summary: "### Overview\nDone." });
    expect((await api.meetings.getTranscript({ id: meeting.id })).items).toEqual(transcript);
  });

  it("completes a meeting whose transcript arrived before room_finished, setting endedAt", async () => {
    const ada = await createUser();
    const meeting = await insertMeeting(ada.id, (await insertAgent(ada.id)).id, {
      status: "active",
      startedAt: new Date(Date.now() - 60_000),
    });

    expect(await processMeeting({ meetingId: meeting.id, transcriptKey: "k" }, deps([]))).toBe("completed");

    const done = await callerFor(ada).meetings.getOne({ id: meeting.id });
    expect(done.status).toBe("completed");
    expect(done.endedAt).toBeInstanceOf(Date);
  });

  it("recovers a meeting the lazy timeout already marked failed", async () => {
    const ada = await createUser();
    const meeting = await insertMeeting(ada.id, (await insertAgent(ada.id)).id, { status: "failed" });

    expect(await processMeeting({ meetingId: meeting.id, transcriptKey: "k" }, deps([]))).toBe("completed");
  });

  it("skips completed or never-started meetings and reports missing ones", async () => {
    const ada = await createUser();
    const agent = await insertAgent(ada.id);
    const completed = await insertMeeting(ada.id, agent.id, { status: "completed", summary: "old" });
    const upcoming = await insertMeeting(ada.id, agent.id);
    const d = deps([item("user", "hi", 0)]);

    expect(await processMeeting({ meetingId: completed.id, transcriptKey: "k" }, d)).toBe("skipped");
    expect(await processMeeting({ meetingId: upcoming.id, transcriptKey: "k" }, d)).toBe("skipped");
    expect(
      await processMeeting({ meetingId: "00000000-0000-4000-8000-000000000000", transcriptKey: "k" }, d),
    ).toBe("missing");
    expect(d.generate).not.toHaveBeenCalled();
    expect((await callerFor(ada).meetings.getOne({ id: completed.id })).summary).toBe("old");
  });

  it("leaves the meeting unchanged when the model fails, so SQS can retry", async () => {
    const ada = await createUser();
    const meeting = await insertMeeting(ada.id, (await insertAgent(ada.id)).id, { status: "processing" });
    const d = deps([item("user", "hi", 0)]);
    d.generate.mockRejectedValueOnce(new Error("model offline"));

    await expect(processMeeting({ meetingId: meeting.id, transcriptKey: "k" }, d)).rejects.toThrow("model offline");
    expect((await callerFor(ada).meetings.getOne({ id: meeting.id })).status).toBe("processing");
  });
});

describe("Ask AI history", () => {
  it("returns the latest messages oldest first, and only to the owner", async () => {
    const ada = await createUser("Ada");
    const bob = await createUser("Bob");
    const meeting = await insertMeeting(ada.id, (await insertAgent(ada.id)).id, { status: "completed" });

    for (let i = 1; i <= 12; i++) {
      await saveMessage(meeting.id, i % 2 ? "user" : "assistant", `message ${i}`);
    }

    const recent = await recentMessages(meeting.id);
    expect(recent).toHaveLength(10);
    expect(recent[0].content).toBe("message 3");
    expect(recent.at(-1)?.content).toBe("message 12");

    expect(await callerFor(ada).meetings.getMessages({ id: meeting.id })).toHaveLength(12);
    await expect(callerFor(bob).meetings.getMessages({ id: meeting.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
