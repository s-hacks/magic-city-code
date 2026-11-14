// Route tests over real HTTP on a random local port. AI is switched off so no live calls happen.
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { Store } from "../src/store";

process.env.AI_DISABLED = "1";

let server: Server;
let base = "";
const store = new Store({ persistPath: null });

beforeAll(async () => {
  server = createApp(store).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((r) => server.close(r)));

const post = (path: string, body: unknown) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("routes", () => {
  it("health says AI is off and sends no CORS header", async () => {
    const res = await fetch(base + "/api/health");
    expect(await res.json()).toEqual({ ok: true, ai: false });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("keeps a generated mission hidden until it is approved", async () => {
    const gen = await (await post("/api/missions/generate", { text: "No grocery store near me and no car." })).json();
    expect(gen.status).toBe("ok");
    const id = gen.mission.id;
    expect(gen.problem.status).toBe("new");
    expect(gen.problem.missionId).toBeUndefined();

    const list = await (await fetch(base + "/api/missions")).json();
    expect(list.some((m: { id: string }) => m.id === id)).toBe(false);
    expect((await fetch(`${base}/api/missions/${id}`)).status).toBe(403);
    expect((await fetch(`${base}/api/missions/${id}?preview=1`)).status).toBe(200);

    const approved = await (await post(`/api/missions/${id}/approve`, {})).json();
    expect(approved.approved).toBe(true);
    const cards = await (await fetch(base + "/api/problems")).json();
    const card = cards.find((c: { id: string }) => c.id === gen.problem.id);
    expect(card.status).toBe("mission");
    expect(card.missionId).toBe(id);
    expect((await (await fetch(base + "/api/missions")).json()).some((m: { id: string }) => m.id === id)).toBe(true);
  });

  it("coach uses the stored mission by id, accepts a public mission, and 404s otherwise", async () => {
    const seed = store.seedMissions()[0] ?? (await (await fetch(base + "/api/missions")).json())[0];
    const ok = await post("/api/coach", { missionId: seed.id, levelIndex: 0, code: "", hintsGiven: 0 });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toMatch(/text\/plain/);
    expect((await ok.text()).length).toBeGreaterThan(0);

    const { levels, ...rest } = seed;
    const publicMission = { ...rest, id: "browser-only", levels: levels.map(({ solution: _s, ...l }: { solution: string }) => l) };
    const viaBrowser = await post("/api/coach", { missionId: "browser-only", mission: publicMission, levelIndex: 0, code: "", hintsGiven: 2 });
    expect(viaBrowser.status).toBe(200);
    expect(await viaBrowser.text()).toBe(levels[0].hints[2]);

    expect((await post("/api/coach", { missionId: "nope", levelIndex: 0, code: "", hintsGiven: 0 })).status).toBe(404);
  });

  it("stores proposals with thing and hubs, scrubbing code and summary", async () => {
    const res = await post("/api/proposals", {
      studentName: "Maya Smith",
      missionId: "feed-the-block",
      missionTitle: "Feed the Block",
      partner: "Shipt",
      neighborhood: "west-end",
      levelIndex: 2,
      code: "# Maya, 205-555-1234\ncity.place_hub(city.sites()[0])",
      thing: "pickup hub",
      hubs: 5,
      before: 0.2,
      after: 0.6,
      helped: 120,
      summary: "Email me at maya@example.com",
    });
    expect(res.status).toBe(201);
    const p = await res.json();
    expect(p.studentName).toBe("Maya");
    expect(p.thing).toBe("pickup hub");
    expect(p.hubs).toBe(5);
    expect(p.code).not.toContain("555-1234");
    expect(p.summary).not.toContain("maya@example.com");
    expect((await (await fetch(`${base}/api/proposals/${p.id}`)).json()).id).toBe(p.id);
  });

  it("resets to the seed state from localhost, and refuses forwarded requests", async () => {
    await post("/api/problems", { text: "A new problem" });
    const forwarded = await fetch(base + "/api/admin/reset", { method: "POST", headers: { "x-forwarded-for": "10.0.0.5" } });
    expect(forwarded.status).toBe(403);
    const res = await post("/api/admin/reset", {});
    expect(res.status).toBe(200);
    expect(await (await fetch(base + "/api/proposals")).json()).toEqual([]);
    const fresh = new Store({ persistPath: null });
    expect((await (await fetch(base + "/api/problems")).json()).length).toBe(fresh.listProblems().length);
    expect(store.listMissions().length).toBe(fresh.listMissions().length);
  });
});
