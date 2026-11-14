// Smoke test: runs REAL Pyodide in Node with city.py and checks actions, line numbers,
// printing and plain-words errors. Slow on the first load (a few seconds).
import { beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { loadPyodide } from "pyodide";
import citySource from "./city.py?raw";
import { createCore, type CoreResult, type RunPayload } from "./core";

const kinds = ["church", "school", "library", "church", "church", "church", "school"] as const;
const payload: RunPayload = {
  sites: kinds.map((kind, i) => ({
    id: `site_${i + 1}`,
    name: `Place ${i + 1}`,
    kind,
    lat: 33.5 + i * 0.01,
    lon: -86.8,
    families_nearby: 100 * (i + 1),
    families_without_car: 10 * ((i * 3) % 7),
    minutes_to_store: 12 + i,
  })),
  stores: [{ id: "store_1", name: "Corner Mart", lat: 33.5, lon: -86.8 }],
  neighborhoods: [{ id: "west-end", name: "West End", bbox: [0, 0, 1, 1], center: [-86.8, 33.5], households: 900 }],
};

let core: ReturnType<typeof createCore>;
let out = "";
const run = (code: string): CoreResult => {
  out = "";
  return core.run(code, payload, (t) => (out += t));
};
const failed = (r: CoreResult) => {
  if (r.ok) throw new Error("expected an error");
  return r;
};

describe("Pyodide + city.py", () => {
  beforeAll(async () => {
    // Under vitest Pyodide can't find its own files, so point it at the npm package folder.
    const indexURL = dirname(createRequire(import.meta.url).resolve("pyodide/package.json")) + "/";
    const pyodide = await loadPyodide({ indexURL });
    core = createCore(pyodide, citySource);
  }, 60_000);

  it("runs a level-2 loop and records line numbers", () => {
    const r = run(`places = city.sites()\nfor place in places[:5]:\n    city.place_hub(place)\n`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.actions.map((a) => a.siteId)).toEqual(["site_1", "site_2", "site_3", "site_4", "site_5"]);
    expect(r.actions.every((a) => a.type === "place_hub" && a.line === 3)).toBe(true);
  });

  it("sorts like level 4 and filters by kind", () => {
    const r = run(
      `places = city.sites(kind="church")\nbest = sorted(places, key=lambda p: p.families_without_car, reverse=True)\ncity.place_hub(best[0])\n`,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0].line).toBe(3);
  });

  it("accepts a site name and `import city`", () => {
    const r = run(`import city\ncity.place_hub("place 2")\ncity.place_hub("site_3")\n`);
    expect(r.ok && r.actions.map((a) => [a.siteId, a.line])).toEqual([["site_2", 2], ["site_3", 3]]);
  });

  it("routes print to stdout, with a readable Site repr", () => {
    run(`print("hello")\nprint(city.sites()[0])\nprint(city.stores()[0], city.neighborhoods()[0])`);
    expect(out).toContain("hello\n");
    expect(out).toContain("Site('Place 1', kind='church', families_nearby=100");
    expect(out).toContain("Store('Corner Mart') Neighborhood('West End', households=900)");
  });

  it("finds friendly error for an unknown site name", () => {
    const r = failed(run(`city.place_hub("Nonexistent")`));
    expect(r.friendly).toBe(`Line 1: I can't find a place called "Nonexistent". Try printing city.sites() to see the names.`);
    expect(r.line).toBe(1);
  });

  it("translates a NameError typo", () => {
    const r = failed(run(`places = city.sites()\nfor p in places:\n    plase_hub(p)\n`));
    expect(r.line).toBe(3);
    expect(r.friendly).toContain("Line 3:");
    expect(r.friendly).toContain("Did you mean `city.place_hub`?");
  });

  it("suggests the student's own variable", () => {
    const r = failed(run(`places = city.sites()\nprint(plases)\n`));
    expect(r.friendly).toContain("Did you mean `places`?");
  });

  it("translates AttributeError on city and on a Site", () => {
    expect(failed(run(`city.plase_hub(city.sites()[0])`)).friendly).toBe(
      "Line 1: The `city` toolbox has no `plase_hub`. Did you mean `city.place_hub`?",
    );
    expect(failed(run(`print(city.sites()[0].familes_nearby)`)).friendly).toContain("Did you mean `families_nearby`?");
  });

  it("translates IndentationError and SyntaxError with line numbers", () => {
    const a = failed(run(`for p in city.sites():\nprint(p)\n`));
    expect(a.line).toBe(2);
    expect(a.friendly).toMatch(/^Line 2: Python expected this line to be indented/);
    const b = failed(run(`x = 1\nprint("hi"\n`));
    expect(b.friendly).toContain("never closed");
    const c = failed(run(`for p in city.sites()\n    print(p)\n`));
    expect(c.line).toBe(1);
    expect(c.friendly).toContain("colon");
  });

  it("translates TypeError, IndexError", () => {
    expect(failed(run(`city.place_hub()`)).friendly).toContain("needs something inside the parentheses");
    const idx = failed(run(`s = city.sites()\nprint(s[99])`));
    expect(idx.line).toBe(2);
    expect(idx.friendly).toContain("spot in the list");
  });

  it("does not leak state between runs", () => {
    run(`secret = 5\ncity.place_hub(city.sites()[0])`);
    const r = failed(run(`print(secret)`));
    expect(r.friendly).toContain("`secret`");
    const ok = run(`pass`);
    expect(ok.ok && ok.actions).toEqual([]);
  });

  it("caps runaway printing", () => {
    run(`for i in range(2000):\n    print(i)`);
    expect(out.split("\n").length).toBeLessThan(510);
    expect(out).toContain("too much output");
  });

  it("treats exit() as a normal stop", () => {
    const r = run(`city.place_hub(city.sites()[0])\nexit()\ncity.place_hub(city.sites()[1])`);
    expect(r.ok && r.actions).toHaveLength(1);
  });
});
