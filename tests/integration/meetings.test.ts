import { beforeEach, describe, expect, it } from "vitest";

import { callerFor, createUser, insertAgent, insertMeeting, resetDatabase } from "../helpers";

beforeEach(resetDatabase);

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

describe("meetings router", () => {
  it("creates an upcoming meeting with the user's own agent", async () => {
    const alice = await createUser();
    const agent = await insertAgent(alice.id);

    const created = await callerFor(alice).meetings.create({ name: "Kickoff", agentId: agent.id });

    expect(created).toMatchObject({ name: "Kickoff", status: "upcoming", userId: alice.id });
  });

  it("refuses to attach another user's agent", async () => {
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    const bobsAgent = await insertAgent(bob.id);
    const ownAgent = await insertAgent(alice.id);
    const api = callerFor(alice);

    await expect(
      api.meetings.create({ name: "Sneaky", agentId: bobsAgent.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Agent not found" });

    const meeting = await insertMeeting(alice.id, ownAgent.id);
    await expect(
      api.meetings.update({ id: meeting.id, name: "Sneaky", agentId: bobsAgent.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "Agent not found" });
  });

  it("returns a meeting with its agent and computed duration", async () => {
    const alice = await createUser();
    const agent = await insertAgent(alice.id, "Coach");
    const meeting = await insertMeeting(alice.id, agent.id, {
      status: "completed",
      startedAt: minutesAgo(10),
      endedAt: minutesAgo(5),
    });

    const fetched = await callerFor(alice).meetings.getOne({ id: meeting.id });

    expect(fetched.agent).toMatchObject({ id: agent.id, name: "Coach" });
    expect(fetched.duration).toBeCloseTo(300, 0);
  });

  it("filters by search, status and agent, with matching totals", async () => {
    const alice = await createUser();
    const tutor = await insertAgent(alice.id, "Tutor");
    const coach = await insertAgent(alice.id, "Coach");
    await insertMeeting(alice.id, tutor.id, { name: "Algebra" });
    await insertMeeting(alice.id, tutor.id, { name: "Geometry", status: "completed" });
    await insertMeeting(alice.id, coach.id, { name: "Fitness", status: "completed" });
    const api = callerFor(alice);

    const completed = await api.meetings.getMany({ status: "completed" });
    expect(completed.total).toBe(2);

    const tutorCompleted = await api.meetings.getMany({ status: "completed", agentId: tutor.id });
    expect(tutorCompleted.items.map((m) => m.name)).toEqual(["Geometry"]);
    expect(tutorCompleted.total).toBe(1);

    const search = await api.meetings.getMany({ search: "ALG" });
    expect(search.items.map((m) => m.name)).toEqual(["Algebra"]);
    expect(search.items[0].agent.name).toBe("Tutor");
  });

  it("hides and protects other users' meetings", async () => {
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    const bobsMeeting = await insertMeeting(bob.id, (await insertAgent(bob.id)).id);
    const api = callerFor(alice);

    expect((await api.meetings.getMany({})).total).toBe(0);
    await expect(api.meetings.getOne({ id: bobsMeeting.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(api.meetings.remove({ id: bobsMeeting.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("marks meetings stuck in processing as failed after the timeout", async () => {
    const alice = await createUser();
    const agent = await insertAgent(alice.id);
    const stale = await insertMeeting(alice.id, agent.id, {
      name: "Stale",
      status: "processing",
      startedAt: minutesAgo(40),
      endedAt: minutesAgo(20),
    });
    const fresh = await insertMeeting(alice.id, agent.id, {
      name: "Fresh",
      status: "processing",
      startedAt: minutesAgo(10),
      endedAt: minutesAgo(5),
    });
    const api = callerFor(alice);

    await api.meetings.getMany({});

    expect((await api.meetings.getOne({ id: stale.id })).status).toBe("failed");
    expect((await api.meetings.getOne({ id: fresh.id })).status).toBe("processing");
  });

  it("updates and removes an owned meeting", async () => {
    const alice = await createUser();
    const agent = await insertAgent(alice.id);
    const meeting = await insertMeeting(alice.id, agent.id);
    const api = callerFor(alice);

    const updated = await api.meetings.update({ id: meeting.id, name: "Renamed", agentId: agent.id });
    expect(updated.name).toBe("Renamed");

    await api.meetings.remove({ id: meeting.id });
    expect((await api.meetings.getMany({})).total).toBe(0);
  });
});
