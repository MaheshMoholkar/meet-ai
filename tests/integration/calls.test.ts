import { WebhookEvent } from "livekit-server-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { remainingBudgetSeconds, secondsUsedToday, startOfUtcDay } from "@/modules/meetings/server/budget";
import { handleLiveKitEvent } from "@/modules/meetings/server/livekit-events";

import { callerFor, createUser, insertAgent, insertMeeting, resetDatabase } from "../helpers";

const livekit = vi.hoisted(() => ({
  createMeetingRoom: vi.fn(),
  createParticipantToken: vi.fn(async () => "jwt-token"),
}));
vi.mock("@/lib/livekit", () => livekit);

beforeEach(async () => {
  await resetDatabase();
  vi.clearAllMocks();
});

describe("daily budget", () => {
  it("starts the UTC day at midnight", () => {
    expect(startOfUtcDay(new Date("2026-10-03T18:45:00Z")).toISOString()).toBe("2026-10-03T00:00:00.000Z");
  });

  it("counts finished and in-progress calls started today, across users", async () => {
    const now = new Date();
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    const aliceAgent = await insertAgent(alice.id);
    const bobAgent = await insertAgent(bob.id);

    // 5 finished minutes + 2 minutes still running.
    await insertMeeting(alice.id, aliceAgent.id, {
      status: "completed",
      startedAt: new Date(now.getTime() - 10 * 60_000),
      endedAt: new Date(now.getTime() - 5 * 60_000),
    });
    await insertMeeting(bob.id, bobAgent.id, {
      status: "active",
      startedAt: new Date(now.getTime() - 2 * 60_000),
    });
    // Never started: doesn't count.
    await insertMeeting(bob.id, bobAgent.id);

    // Skip the check right after midnight UTC, when "10 minutes ago" is yesterday.
    if (now.getTime() - startOfUtcDay(now).getTime() > 11 * 60_000) {
      expect(await secondsUsedToday(now)).toBeCloseTo(7 * 60, 0);
      expect(await remainingBudgetSeconds(30, now)).toBe(23 * 60);
    }
  });

  it("ignores calls from previous days", async () => {
    const alice = await createUser();
    const agent = await insertAgent(alice.id);
    const yesterday = new Date(startOfUtcDay(new Date()).getTime() - 60 * 60_000);
    await insertMeeting(alice.id, agent.id, {
      status: "completed",
      startedAt: yesterday,
      endedAt: new Date(yesterday.getTime() + 20 * 60_000),
    });

    expect(await secondsUsedToday()).toBe(0);
  });
});

describe("meetings.join", () => {
  it("creates the room with the agent's metadata and returns a token", async () => {
    const alice = await createUser("Alice");
    const agent = await insertAgent(alice.id, "Coach");
    const meeting = await insertMeeting(alice.id, agent.id);

    const result = await callerFor(alice).meetings.join({ id: meeting.id });

    expect(result).toEqual({ token: "jwt-token", serverUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL });
    expect(livekit.createMeetingRoom).toHaveBeenCalledWith({
      meetingId: meeting.id,
      agentName: "Coach",
      instructions: "Be helpful.",
      maxDurationSec: 30 * 60,
    });
    expect(livekit.createParticipantToken).toHaveBeenCalledWith({
      identity: alice.id,
      name: "Alice",
      room: meeting.id,
    });
  });

  it("refuses meetings that have ended or aren't yours", async () => {
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    const agent = await insertAgent(alice.id);
    const done = await insertMeeting(alice.id, agent.id, { status: "completed" });

    await expect(callerFor(alice).meetings.join({ id: done.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(callerFor(bob).meetings.join({ id: done.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(livekit.createMeetingRoom).not.toHaveBeenCalled();
  });

  it("refuses new calls once the daily budget is used up", async () => {
    const alice = await createUser();
    const agent = await insertAgent(alice.id);
    const now = Date.now();
    const sinceMidnight = now - startOfUtcDay(new Date(now)).getTime();
    // Use the whole 30-minute budget with today's calls (start no earlier than midnight).
    const startedAt = new Date(now - Math.min(sinceMidnight, 31 * 60_000));
    await insertMeeting(alice.id, agent.id, { status: "active", startedAt });
    const meeting = await insertMeeting(alice.id, agent.id);

    if (sinceMidnight >= 31 * 60_000) {
      await expect(callerFor(alice).meetings.join({ id: meeting.id })).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
      expect(livekit.createMeetingRoom).not.toHaveBeenCalled();
    }
  });

  it("reports a friendly error when the call server is unreachable", async () => {
    const alice = await createUser();
    const meeting = await insertMeeting(alice.id, (await insertAgent(alice.id)).id);
    livekit.createMeetingRoom.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(callerFor(alice).meetings.join({ id: meeting.id })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Couldn't start the call. Please try again.",
    });
  });
});

describe("LiveKit webhook events", () => {
  // Same parsing path as WebhookReceiver.receive (the constructor drops the event name).
  const event = (json: object) => WebhookEvent.fromJson(json as Parameters<typeof WebhookEvent.fromJson>[0]);
  const participantJoined = (room: string, kind: "STANDARD" | "AGENT" | "EGRESS") =>
    event({ event: "participant_joined", room: { name: room }, participant: { identity: "x", kind } });

  it("moves a meeting through active and processing, ignoring repeats, the agent and the recorder", async () => {
    const alice = await createUser();
    const meeting = await insertMeeting(alice.id, (await insertAgent(alice.id)).id);
    const api = callerFor(alice);

    await handleLiveKitEvent(participantJoined(meeting.id, "AGENT")); // the agent
    await handleLiveKitEvent(participantJoined(meeting.id, "EGRESS")); // the recorder
    expect((await api.meetings.getOne({ id: meeting.id })).status).toBe("upcoming");

    await handleLiveKitEvent(participantJoined(meeting.id, "STANDARD")); // the human
    const active = await api.meetings.getOne({ id: meeting.id });
    expect(active.status).toBe("active");
    expect(active.startedAt).toBeInstanceOf(Date);

    // A late duplicate doesn't reset startedAt.
    await handleLiveKitEvent(participantJoined(meeting.id, "STANDARD"));
    expect((await api.meetings.getOne({ id: meeting.id })).startedAt).toEqual(active.startedAt);

    await handleLiveKitEvent(event({ event: "room_finished", room: { name: meeting.id } }));
    const processing = await api.meetings.getOne({ id: meeting.id });
    expect(processing.status).toBe("processing");
    expect(processing.endedAt).toBeInstanceOf(Date);
  });

  it("keeps a meeting upcoming when its room closes before anyone joined", async () => {
    const alice = await createUser();
    const meeting = await insertMeeting(alice.id, (await insertAgent(alice.id)).id);

    await handleLiveKitEvent(event({ event: "room_finished", room: { name: meeting.id } }));

    expect((await callerFor(alice).meetings.getOne({ id: meeting.id })).status).toBe("upcoming");
  });

  it("records the recording key only when egress completed", async () => {
    const alice = await createUser();
    const meeting = await insertMeeting(alice.id, (await insertAgent(alice.id)).id);
    const api = callerFor(alice);

    await handleLiveKitEvent(
      event({ event: "egress_ended", egressInfo: { roomName: meeting.id, status: "EGRESS_FAILED" } }),
    );
    expect((await api.meetings.getOne({ id: meeting.id })).recordingKey).toBeNull();

    await handleLiveKitEvent(
      event({ event: "egress_ended", egressInfo: { roomName: meeting.id, status: "EGRESS_COMPLETE" } }),
    );
    expect((await api.meetings.getOne({ id: meeting.id })).recordingKey).toBe(
      `recordings/${meeting.id}.mp4`,
    );
  });

  it("ignores rooms that aren't meetings", async () => {
    await expect(
      handleLiveKitEvent(event({ event: "room_finished", room: { name: "lobby" } })),
    ).resolves.toBeUndefined();
  });
});
