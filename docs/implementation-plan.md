# Magic City Code — implementation plan

Kids learn to code by fixing their own city. A resident reports a real Birmingham problem, AI turns it into a coding mission on a 3D map of the real city, a student solves it with a few lines of Python, and the solution goes back to the community as a proposal.

Built for Shipt Hacks. Partner fit: Ed Farm (the platform), Jones Valley Teaching Farm (food mission), Firehouse Ministries (shelter mission), Birmingham Promise (student portfolio).

## 1. The one loop the app must prove

1. A resident types a problem ("No grocery store near West End").
2. AI turns it into a mission: a place on the map, a goal, a score, starter code.
3. A student writes Python. The 3D city reacts: residents move, colors change, the score updates.
4. One click makes a proposal page with the student's numbers, addressed to the resident and a partner.

Everything in this plan serves that loop. Anything that does not is a stretch item.

## 2. Constraints

| Fact or assumption | What it means for the plan |
|---|---|
| **About 8 hours of build time** (confirmed) | Only the Must tier in section 3 is planned. Everything else is built only if time is left. |
| **Judges watch the team's laptop and do not use their own devices** (confirmed) | Build for one screen on a projector. No phone layout, no hosting, no login. |
| **A Claude API key is available** (confirmed) | The mission generator and the coach call Claude from the server. |
| Team size is not confirmed | Section 14 marks which phases can run side by side if there are several people. |
| Submission is a GitHub repo plus a live demo | Taken from the program slides. |

## 3. Scope

| Tier | What is in it | Cut rule |
|---|---|---|
| **Must** (hours 0–6) | 3D night map of Birmingham; one "coverage" mission (grocery pickup hubs) with three levels; Python editor that changes the map; glowing residents, light beams and the city-light score from [ui-plan.md](ui-plan.md); hold-to-compare before/after; AI mission generator limited to coverage missions; problem flares on the home map | If any of these is missing, there is no demo. |
| **Should** (only if ahead of schedule at hour 6) | AI coach that gives hints only; proposal page; line-by-line run animation | Build in this order. |
| **Next steps** (not built) | Real walking routes; levels 3 and 5; bus-route mission; shelter-matching mission; block-based coding; voice; teacher dashboard; text-message problem intake | Shown on a "what's next" slide. |

**Feature freeze at hour 6.** After that, only bug fixes, the backup video and rehearsal.

## 4. The key design decision

**Student code does not draw anything. It only produces a list of actions. A separate engine applies the actions and computes the result.**

```
student Python  →  list of actions  →  simulate(mission, actions)  →  metrics + animation data  →  map
                   [{place_hub: "site_12"}, ...]
```

Why this matters:

- **Safe.** The Python runs in a sandboxed browser worker with a 5-second limit. A bad loop cannot freeze the page.
- **Explainable.** `simulate` is one pure function: same inputs, same outputs. Any team member can explain it to a judge and test it without a browser.
- **Before/after is free.** Run `simulate` once with no actions and once with the student's actions, then compare.
- **AI missions are safe.** The AI only fills in a mission config. It never writes engine code.

## 5. Architecture

```
┌──────────────────────── Browser ────────────────────────┐
│  React app                                              │
│  ├─ Map view      MapLibre (3D buildings) + deck.gl     │
│  ├─ Code panel    CodeMirror editor, Run button, output │
│  ├─ Mission panel story, goal, score, hints, coach      │
│  ├─ Engine        simulate(mission, actions)  (pure TS) │
│  └─ Python worker Pyodide + the `city` helper module    │
└───────────────┬─────────────────────────────────────────┘
                │ HTTPS (JSON, streamed text)
┌───────────────┴────────── Server (Node + Express) ──────┐
│  POST /api/missions/generate   resident text → mission  │
│  POST /api/coach               streamed hint            │
│  GET/POST /api/problems        resident problem board   │
│  GET/POST /api/proposals       saved student proposals  │
│  Claude API key lives here only, never in the browser   │
└──────────────────────────────────────────────────────────┘

Offline, before the event:  Python data scripts → static JSON files in web/public/data/
```

## 6. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite 6 | Fast to build and widely known. Vite 7 needs Node 20.19+; this machine has 20.17, so pin Vite 6 or upgrade Node. |
| 3D map | MapLibre GL JS with OpenFreeMap tiles | Free, no API key, real building footprints with heights. |
| Data layers and animation | deck.gl | Draws thousands of moving dots smoothly. |
| Student code | Pyodide (Python in the browser) inside a Web Worker | Real Python, no server, isolated from the page. |
| Editor | CodeMirror 6 | Lighter than Monaco, good on school Chromebooks. |
| Server | Node 20 + Express + Zod | One language across the app. Zod checks every AI response. |
| AI | Claude API through `@anthropic-ai/sdk`, model `claude-opus-5-5` | Structured outputs for the mission generator, streaming for the coach. A cheaper, faster model for the coach is a choice the team can make later. |
| Storage | In memory, seeded from one JSON file | Enough for a demo and easy to explain. Swap for a database later. |
| Data prep | Python scripts run with `uv` (use Python 3.12 for map libraries) | Run once before the event. Output is plain JSON. |
| Package manager | pnpm workspaces | Already installed. |

## 7. Data

All data is public. One script, `data/build.py`, downloads it, trims it to Birmingham, and writes small JSON files. The app never calls these sources live.

| File produced | What it holds | Source | Status |
|---|---|---|---|
| `areas.json` | Census block groups in Birmingham: shape, households, households with no car, households in poverty, kids, seniors, households with no internet | Census ACS 5-year (Jefferson County, FIPS 01073) + Census boundary files | Reliable. Confirm the internet table is published for block groups; if not, use tract values. These columns power the missions in [showcase-examples.md](showcase-examples.md). |
| `stores.json` | Existing supermarkets, whole city | OpenStreetMap (one Overpass query) | Check the focus area by eye and fix by hand |
| `sites.json` | Places that could host a hub: churches, schools, libraries, rec centers | OpenStreetMap (same query) | Reliable |
| `neighborhoods.json` | 8–10 named neighborhoods with map boxes (Ensley, West End, Woodlawn, East Lake, ...) | Written by hand | 15 minutes of work |
| `problems.seed.json` | 6–8 starter problem cards | The research report in `reports/` | Written by hand |

Two shortcuts taken for the 8-hour build:

- **Walking time is an estimate.** The engine uses straight-line distance × 1.3 at walking speed. It ignores highways and missing sidewalks. The app labels it "estimated walk." Real street routes are a next step.
- **Need is measured from Census data** (households with no car, far from a store). The USDA food-desert file is not loaded.

The data covers the whole city, so the mission generator can target any listed neighborhood. Only the focus area (West End / Ensley) is checked by hand.

Checks to run in the first 40 minutes, each with a fallback:

- OpenFreeMap tiles load with 3D buildings. Fallback: another free tile host, or flat buildings.
- The Census API responds without a key. Fallback: download the two tables by hand.
- The Overpass query returns stores and sites. Fallback: a smaller query for the focus area only.

## 8. The engine

`engine/simulate.ts` exports one function:

```ts
simulate(mission: Mission, actions: Action[]): Result
```

For a coverage mission it does four things:

1. Start with the existing stores as food sources. Add each hub the student placed.
2. For every block group, find the shortest walk to any food source.
3. Compute the metrics:
   - **Coverage:** share of households within the mission's walk limit (default 10 minutes).
   - **Average walk:** household-weighted minutes.
   - **Households helped:** covered now minus covered before.
4. Create about 3,000 resident dots, placed in proportion to households. Each dot gets a path to its nearest food source and a color: green (within the limit), yellow, red.

The same code handles any "place N things to reach the most people" problem by swapping three settings: what is placed, which sites are allowed, and which need column is counted (no-car households, kids, seniors). This is what lets the AI generator produce many different missions from one engine.

Rules enforced by the engine, with friendly messages: the maximum number of hubs, no duplicate sites, and only sites inside the mission area.

Unit tests cover: zero actions equals the baseline, one known hub gives a hand-checked coverage number, and rule violations return clear errors.

## 9. What the student writes

A small Python module named `city` is loaded for them. Example solution for level 4:

```python
places = city.sites(kind="church")

# pick the places with the most families who can't easily reach a store
best = sorted(places, key=lambda p: p.families_without_car, reverse=True)

for place in best[:5]:
    city.place_hub(place)
```

| Function | What it does |
|---|---|
| `city.sites(kind=None)` | List of places that could host a hub. Each has `name`, `kind`, `families_nearby`, `families_without_car`, `minutes_to_store`. |
| `city.stores()` | Existing grocery stores. |
| `city.place_hub(site)` | Put a pickup hub at that site. |
| `city.neighborhoods()` | Areas in this mission, with household counts. |
| `print(...)` | Shows in the output panel. |

Learning ladder inside the mission (each level unlocks the next):

| Level | Coding idea | Task |
|---|---|---|
| 1 | Calling a function | Place one hub at a named church. |
| 2 | Loops | Place hubs at the first five sites. |
| 3 | If statements | Skip sites that are already close to a store. |
| 4 | Sorting and choosing | Pick the five sites that help the most families. |
| 5 | Trade-offs | Reach 80% coverage with the fewest hubs. |

The 8-hour build includes levels 1, 2 and 4. Levels 3 and 5 are next steps.

Python errors are caught and shown in plain words ("Line 3: Python doesn't know the word `plase_hub`. Did you mean `place_hub`?").

## 10. Mission config

Every mission, seeded or AI-made, is one JSON object checked by a Zod schema in `shared/mission.ts`:

```ts
{
  id, title, story,                 // kid-friendly text
  partner,                          // e.g. "Jones Valley Teaching Farm"
  type: "coverage",                 // stretch: "route" | "dispatch" | "match"
  area: { neighborhood, bbox },     // must be in neighborhoods.json
  thing: "pickup hub",              // what the student places
  siteKinds: ["church", "school"],  // where it may go
  needColumn: "households_no_car",  // who we are trying to reach
  walkMinutes: 10, maxPlacements: 5,
  goal: { metric: "coverage", target: 0.8 },
  starterCode, hints: [..3],
  source: { kind: "seed" | "resident", text }
}
```

Seed missions:

| Mission | Partner | Type | Tier |
|---|---|---|---|
| Feed the Block: pickup hubs in a food desert | Jones Valley Teaching Farm, Shipt | coverage | Must |
| Catch the Bus: improve one route within a bus budget | Ed Farm | route | Stretch |
| Open Bed: match people to shelter beds (made-up data only) | Firehouse Ministries | match | Stretch |

## 11. AI features

All three run on the server. The key stays in a server environment variable.

**Mission generator** (`POST /api/missions/generate`)

- Input: the resident's text.
- Claude returns a mission config using structured outputs, so the reply always matches the schema.
- The prompt lists the allowed neighborhoods, site kinds and need columns. The AI chooses among them and writes the story, starter code and hints.
- The server then checks: the schema is valid, the neighborhood exists, and the area has data. If a check fails, it retries once, then falls back to the closest seed mission.
- If the problem cannot be a coverage mission (for example "my water bill is wrong"), the AI says so and the card is saved as "needs a new mission type."
- Safety: remove names, phone numbers and addresses from the resident's text; keep the story suitable for children; a teacher approves a mission before students see it. In the demo, approval is one click.

**Coach** (`POST /api/coach`, streamed)

- Input: the mission, the student's code, and the last error or score.
- Rules in the system prompt: one hint at a time, at most three sentences, grade-level words, never the full solution. Hints go nudge → idea → a worked example on a different problem.
- This mirrors the hackathon's own "Code Authorship" value: the tool makes students understand their code.

**Proposal** (Should tier)

- A printable page: map picture, before and after numbers, the student's code, and a three-sentence summary.
- It carries a plain label: "A student proposal based on public data. A starting point for discussion, not an engineering study."

API notes for whoever builds this: use the official SDK; set effort explicitly (`low` for the coach, `medium` for the generator); check `stop_reason` before reading the reply; keep the long, unchanging part of each prompt first so prompt caching can reuse it. Read the SDK's TypeScript guide before writing the calls.

## 12. Screens

| Screen | What is on it |
|---|---|
| **Home** | Fly-in over 3D Birmingham. Problem cards from residents. "Report a problem" button. |
| **Mission** | Three parts: the map (largest), the code panel with a big Run button, and the mission panel (story, goal, score meter, hints, coach). Before/After toggle on the map. |
| **Report a problem** | One text box and a neighborhood picker. Shows the generated mission for approval. |
| **Proposal** | The printable one-pager. |

The look, motion and layout of these screens are in [ui-plan.md](ui-plan.md). Design rules: built for one laptop on a projector; readable from the back of a room; no login; color is never the only signal; a clear success moment when the goal is reached.

## 13. Repo layout

```
shipt-hackathon/
├─ web/                 React app
│  ├─ src/map/          MapView, layers, before/after
│  ├─ src/code/         Editor, Python worker, city.py helper
│  ├─ src/engine/       simulate.ts + tests   (pure, no React)
│  ├─ src/mission/      Mission panel, score, hints, coach chat
│  ├─ src/pages/        Home, Mission, Report, Proposal
│  └─ public/data/      JSON produced by the data scripts
├─ server/              Express app: routes, Claude calls, JSON store
├─ shared/              Mission schema and types used by both sides
├─ data/                Python scripts that build public/data/
├─ docs/                This plan, ui-plan.md, decisions.md, ai-log.md
├─ reports/             Research report
└─ research_notes/      Research notes
```

## 14. Build phases

Sized for 8 hours. Each phase ends with something visible on screen.

| Phase | Clock | Work | Done when |
|---|---|---|---|
| **0. Setup and de-risk** | 0:00–0:40 | Scaffold the workspace. Show the 3D night map. Run "hello" in Pyodide. Make one Claude call. Run the data checks from section 7. | All four work on the demo laptop. |
| **1. Data** | 0:40–1:30 | `data/build.py`, the hand-written neighborhood list, a by-eye check of the focus area. | Stores, sites and block groups appear on the map. |
| **2. Engine** | 0:40–1:30 | `simulate` for coverage missions, with three tests. | Tests pass. Hard-coded actions change the score. |
| **3. Code loop** | 1:30–2:45 | Python worker, `city` module, Run button, plain-word errors, 5-second limit. | Typing `city.place_hub(...)` and pressing Run changes the score. |
| **4. Living city** | 2:45–4:15 | Glowing residents, light beams, ripple rings, the city-light meter, hold-to-compare, the fly-in. | The city visibly lights up when code runs. |
| **5. Mission screen** | 4:15–5:00 | Floating panels, story, goal, three levels, success moment, demo keys. | Someone new finishes level 1 without help. |
| **6. Mission generator** | 5:00–6:00 | Server route, prompt, schema checks, fallback, report box, problem flares on the home map. | Five different typed problems each give a playable mission or a clear "can't do this yet." |
| **Feature freeze** | 6:00 | No new features after this point. | |
| **7. Should items** | 6:00–6:45 | The coach, then the proposal page. Only if everything above is solid; otherwise fix bugs. | The coach refuses to give the answer when asked directly. |
| **8. Rehearse and record** | 6:45–8:00 | Backup video, three rehearsals, `ai-log.md` and `decisions.md`, the explain-back, push the repo. | Three clean run-throughs in a row. |

Phases 1 and 2 run side by side if there are two or more people. So do the two halves of phase 4 (map effects and the meter). With one person, drop phase 7.

Suggested split for several people: map and visuals; engine and data; Python worker and editor; server and AI.

## 15. How this scores on the judging criteria

| Criterion | What the team does for it |
|---|---|
| **Creativity & Originality** | Live resident problems become coding levels in the students' own city. Show the generator early in the demo. |
| **Technical Implementation** | One loop that works end to end. Pure engine with tests. Fallbacks for every AI call. A recorded backup video. |
| **Code Authorship** | See the practices below. This criterion is won before the demo, not during it. |
| **User Experience & Design** | Three-part mission screen, one big Run button, plain-word errors, a clear before/after. Test with someone who has never seen it. |
| **Problem-Solving & Value** | Real data from the research report; a named partner for each mission; an honest label on proposals. |
| **Reasoning & Explanation** | `docs/decisions.md` records each major choice and what was rejected. The pitch follows the one loop. |

Code Authorship practices:

- **Each person owns a part** and can walk a judge through it line by line.
- **`docs/ai-log.md`:** a short entry each time AI wrote or changed something important: what was asked, what was kept, what was changed or rejected, and why.
- **Small files with a plain-words comment at the top** saying what the file is for.
- **Explain-back before the demo:** each person explains someone else's part for two minutes.
- **AI is used on purpose inside the product too:** it writes mission text and gives hints, and it is deliberately barred from writing engine code or giving students answers. Say this in the pitch.

## 16. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Map tiles fail on venue Wi-Fi | Phone hotspot; recorded backup video. |
| Pyodide is slow to load (about 10 MB) | Load it at app start with a progress message; it is cached after the first load. |
| The AI returns an unusable mission | Schema check, one retry, then the nearest seed mission. |
| The live "name a problem" moment goes wrong | Keep three tested problems ready and offer them as choices. |
| Estimated walking times look wrong near highways | Label them as estimates; pick a focus area where they are sensible. |
| The night map looks washed out on the projector | Test on a projector or TV early. A brighter "day" style is one key away. |
| A typo during the live coding moment | Demo keys insert the prepared solution for each level. |
| The team runs out of time | Feature freeze at hour 6. One polished mission beats three rough ones. |

## 17. Privacy and child safety

- No student accounts. A student enters a first name or nickname only, and only for the proposal.
- Resident reports have names, phone numbers and addresses removed before saving.
- The shelter mission uses made-up people. Never real client data.
- Missions are approved by an adult before students see them.
- Proposals are labeled as student work based on public data.

## 18. The three-minute demo

1. **Hook (20 s):** "Kids in Birmingham learn to code on games about made-up worlds. Their own city has real problems they could work on."
2. **The city (20 s):** Fly into 3D Birmingham. Residents are moving. Red areas are far from food.
3. **A real problem becomes a mission (40 s):** A judge picks or types a problem. The mission appears.
4. **A student codes (50 s):** Type five lines. Press Run. Dots turn green and the score climbs. Toggle before and after.
5. **It goes back (25 s):** Open the proposal page addressed to the partner.
6. **Close (25 s):** How it was built, who owns which part, and what comes next.

## 19. Open questions

- How many people are on the team?
- Is the demo shown on a projector or a large screen, and at what resolution?
- Is there a required submission format beyond the GitHub repo and demo?
