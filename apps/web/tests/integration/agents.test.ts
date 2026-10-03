import { beforeEach, describe, expect, it } from "vitest";

import { callerFor, createUser, insertAgent, insertMeeting, resetDatabase } from "../helpers";

beforeEach(resetDatabase);

describe("agents router", () => {
  it("rejects callers without a session", async () => {
    await expect(callerFor(null).agents.getMany({})).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("creates an agent and reads it back with a meeting count", async () => {
    const alice = await createUser();
    const api = callerFor(alice);

    const created = await api.agents.create({ name: "  Math tutor ", instructions: "Explain." });
    expect(created.name).toBe("Math tutor");

    await insertMeeting(alice.id, created.id);
    const fetched = await api.agents.getOne({ id: created.id });

    expect(fetched).toMatchObject({ id: created.id, userId: alice.id, meetingCount: 1 });
    expect(fetched.createdAt).toBeInstanceOf(Date);
  });

  it("rejects invalid input", async () => {
    const api = callerFor(await createUser());
    await expect(api.agents.create({ name: " ", instructions: "x" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("paginates newest first and searches by name", async () => {
    const alice = await createUser();
    for (const name of ["Alpha", "Beta", "Gamma"]) await insertAgent(alice.id, name);
    const api = callerFor(alice);

    const firstPage = await api.agents.getMany({ page: 1, pageSize: 2 });
    expect(firstPage.items.map((a) => a.name)).toEqual(["Gamma", "Beta"]);
    expect(firstPage).toMatchObject({ total: 3, totalPages: 2 });

    const search = await api.agents.getMany({ search: "alp" });
    expect(search.items.map((a) => a.name)).toEqual(["Alpha"]);
    expect(search.total).toBe(1);
  });

  it("treats LIKE wildcards in search as literal characters", async () => {
    const alice = await createUser();
    await insertAgent(alice.id, "Plain");
    await insertAgent(alice.id, "100% focus");

    const result = await callerFor(alice).agents.getMany({ search: "%" });
    expect(result.items.map((a) => a.name)).toEqual(["100% focus"]);
  });

  it("hides and protects other users' agents", async () => {
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    const bobsAgent = await insertAgent(bob.id, "Bob's agent");
    const api = callerFor(alice);

    expect((await api.agents.getMany({})).total).toBe(0);
    await expect(api.agents.getOne({ id: bobsAgent.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      api.agents.update({ id: bobsAgent.id, name: "Mine now", instructions: "x" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(api.agents.remove({ id: bobsAgent.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect((await callerFor(bob).agents.getOne({ id: bobsAgent.id })).name).toBe("Bob's agent");
  });

  it("updates an owned agent", async () => {
    const alice = await createUser();
    const agent = await insertAgent(alice.id);

    const updated = await callerFor(alice).agents.update({
      id: agent.id,
      name: "Renamed",
      instructions: "New instructions",
    });

    expect(updated).toMatchObject({ name: "Renamed", instructions: "New instructions" });
  });

  it("removes an agent together with its meetings", async () => {
    const alice = await createUser();
    const agent = await insertAgent(alice.id);
    await insertMeeting(alice.id, agent.id);
    const api = callerFor(alice);

    await api.agents.remove({ id: agent.id });

    expect((await api.agents.getMany({})).total).toBe(0);
    expect((await api.meetings.getMany({})).total).toBe(0);
  });
});
