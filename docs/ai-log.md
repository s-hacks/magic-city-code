# AI log

One entry per meaningful AI-written piece. Dates and files come from `git log main..build`. Newest entries go at the bottom.

Format: date, what was asked, what was kept, what was changed or rejected, and why. "reason: ask the owner" means the reason is not in the plan, a commit or the conversation.

---

## 1. Shared contract and workspace scaffold
- **Date:** 2026-11-14 (commit f03082b)
- **Owner area:** coordinator
- **Asked:** write the shared types (data, mission, engine, API) and the worker protocol before any agent starts, so agents can work in parallel on fixed names.
- **Kept:** the types in `shared/`, the pnpm workspace, the Vite and TypeScript setup.
- **Changed or rejected:** no record of rejected options in the commits. reason: ask the owner.

## 2. Claude Code subagent roster
- **Date:** 2026-11-14 (commit 2e228b9)
- **Owner area:** coordinator
- **Asked:** one agent per folder, each with its own role file in `.claude/agents/`.
- **Kept:** ten role files. Models are listed in the root README.
- **Changed or rejected:** none recorded.

## 3. Pure simulation engine
- **Date:** 2026-11-14 (commits 57d7bbe, ef28394, 7ab369d)
- **Owner area:** engine-builder (Opus)
- **Asked:** `simulate(mission, actions)` as one pure function, with tests.
- **Kept:** one pure function, the rule checks (max hubs, no duplicate sites, sites inside the area), and the tests.
- **Changed:**
  - First version scored coverage at block-group centers. This gave threshold artifacts: a new store at the old Save-A-Lot showed 0 gain, because the nearest center was 10.3 minutes away. Coverage now uses weighted resident dots (ef28394).
  - Added `existingSources: "none"`, so Wi-Fi spots and warming stations do not count grocery stores (ef28394).
  - Dots are spread by households, not by need, to fix dense diagonal bands in Woodlawn. Need stays as each dot's weight (7ab369d).
- **Rejected:** center-point scoring (see decisions.md).

## 4. Data pipeline
- **Date:** 2026-11-14 (commits f2830a1, 41e4d81, f796067, 85c08c9)
- **Owner area:** data-prep (Sonnet)
- **Asked:** `data/build.py` writes the static city JSON.
- **Kept:** OpenStreetMap stores and sites, Census block groups, household, need and neighborhood columns.
- **Changed:**
  - The Census API needs a key, so the script uses the ACS bulk summary files instead.
  - Neighborhood bboxes come from the city's official neighborhood layer.
  - The West End Save-A-Lot (closed Sept 2023) is removed from `stores.json` and kept in `former_stores.json` for the one-store-vs-hubs comparison.
  - Supermarkets within 2.5 km of the city line are kept, after code review. Edge neighborhoods shop in Midfield, Homewood and other nearby cities.
  - A filter that dropped non-Christian places of worship was removed by the coordinator. Every faith's building can host a hub.
- **Rejected:** none recorded beyond the above. The 2.5 km value is about four times the 10-minute walk radius, so it keeps every store that could change a resident's color (coordinator's choice).

## 5. Python sandbox and editor
- **Date:** 2026-11-14 (commits 9e8a348, 071d937)
- **Owner area:** python-sandbox (Sonnet)
- **Asked:** Pyodide in a Web Worker, a 5 s limit, a CodeMirror editor, plain-words errors.
- **Kept:** Pyodide in a worker with a 5 s kill, the `city` module, CodeMirror, Damerau-Levenshtein "did you mean" hints.
- **Changed after review:**
  - Python state resets on every run.
  - A crashed worker restarts.
  - Ctrl+Enter and Cmd+Enter both run the code.

## 6. Express server and Claude mission generator
- **Date:** 2026-11-14 (commits 8f88bff, 328d575)
- **Owner area:** server-ai (Opus)
- **Asked:** a server that turns resident text into a mission, with Claude and fallbacks.
- **Kept:** Express routes, the keyword classifier, seed missions as fallbacks, schema and neighborhood checks, the scrub step.
- **Changed:**
  - Generated missions are calibrated. Each level's solution and starter code run in real Pyodide in Node, and the engine scores them. Target = floor(coverage). A failed check gets one retry with the errors. Both attempts share a 25 s deadline.
  - Reason for calibrating against the real engine: the commit says so ("Calibrate generated mission targets with Pyodide and the engine"). Floor rounding guarantees the solution meets its own target.
- **Rejected:** a fixed target typed by the AI, because a judge's live mission could be unwinnable or trivially easy.

## 7. Coach and server hardening
- **Date:** 2026-11-14 (commits ac83de8, d7370d3)
- **Owner area:** server-ai (Opus)
- **Asked:** the coach gives one hint at a time and never gives the solution.
- **Kept:** Claude streamed at effort low, the leak guard, scrubbing of student text, the stored hint as fallback.
- **Changed after code review:**
  - The browser sends only the mission id. The server uses its own copy of the mission, so solutions never reach the coach endpoint.
  - Approval gate: unapproved missions are not listed or served, except with `?preview=1`.
  - The server listens on 127.0.0.1 only.
  - Deadlines on AI calls (8 s for the coach).
  - A reset route for demos.
- **Rejected:** none recorded. Localhost-only and no CORS were chosen because, per code review, anyone on the venue Wi-Fi could otherwise post to the projected board, spend the API key or approve missions.

## 8. Night map and layers
- **Date:** 2026-11-14 (commits cabf61c, 14fdeee)
- **Owner area:** map-visuals (Opus)
- **Asked:** MapLibre with OpenFreeMap, restyled for night, with deck.gl layers for residents, hubs, beams and flares.
- **Kept:** the night style, additive glow, beams that drop in placement order and drive the editor's line highlight.
- **Changed:** cancel stale runs, retry a failed map style, legend labels, hub label layout (14fdeee).
- **Measured:** 120 fps on M1 hardware, per the map-visuals notes.

## 9. Seed missions and problem cards
- **Date:** 2026-11-14 (commits 7b4661b, e2e61b1, e570aac)
- **Owner area:** mission-content (Sonnet)
- **Asked:** five showcase missions and their problem cards.
- **Kept:** the five missions: Farm Stand, Feed the Block, Homework Hotspots, Saturday Shuttle, Warm Nights.
- **Changed:**
  - Targets were calibrated from real data three times, as the engine and data changed (e2e61b1 and later).
  - Level 4 of the missions needed a "skip sites too close to one already chosen" step. Plain sorting clustered the picks and scored below the plain loop.
  - Feed the Block was recalibrated after nearby stores were added (e570aac).
- **Honesty note, Warm Nights:** there is no public data on where people sleeping outside are. The mission counts seniors and low-income households instead, and the app says so on screen.

## 10. Screens and wiring
- **Date:** 2026-11-14 (commits 5d2f683, e3d93b3)
- **Owner area:** mission-ui (Sonnet)
- **Asked:** Home, Mission, Report and Proposal screens, wired end to end.
- **Kept:** the four screens, the storage helpers, the demo keys (Ctrl+Shift+1/2/3).
- **Changed after review:**
  - A level-switch race was fixed, and a run lock was added.
  - Unapproved missions were reachable. The approval gate now blocks them.
  - Solutions were sent to the coach endpoint. Fixed by sending only the mission id.
  - Browser timeouts were added.
  - Proposal wording said "food" for every mission. Wording is now per mission.
  - The 1280x720 layout and the reset path were added.

## 11. Showcase examples doc
- **Date:** 2026-11-14 (commit dd2b896)
- **Owner area:** coordinator
- **Asked:** a doc of the five showcase examples with results computed by the app.
- **Kept:** the file as committed. Not edited by this log.

## 12. Code review and demo QA fix batch
- **Date:** 2026-11-14 (commits d7370d3, 14fdeee, 7ab369d, e3d93b3)
- **Owner area:** code-reviewer (Opus), demo-qa (Sonnet)
- **Found:** level-switch race, unapproved missions reachable, solutions sent to the coach endpoint, the city module persisting between runs, no browser timeouts, proposal wording that said "food" for every mission.
- **Fixed:** the items listed in entries 5, 7 and 10.

## 13. Docs and header comments
- **Date:** 2026-11-14 (this entry added by docs-scribe)
- **Asked:** the authorship record, the decisions record, the root README, and header comments on the server test files.
- **Kept:** the tests' code. Only one comment line was added to each of five test files (`classify`, `coach`, `generator`, `scrub`, `validate`).
- **Changed:** none in code.
