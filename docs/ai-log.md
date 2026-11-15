# AI log

One entry per meaningful AI-written piece. Dates and files come from `git log main..build`. Newest entries go at the bottom.

Format: date, what was asked, what was kept, what was changed or rejected, and why. "reason: ask <name>" means the reason is not in the plan, a commit or the conversation, so ask the named owner.

Team owners: **Pranay** (backend, challenges and tests: server, shared, data, engine, challenges), **Margulan** (frontend and research: screens, map, landing, editor, reports). "Owner area" in each entry names the folder or the AI agent that did the work; the human who owns that folder is listed in [SUBMISSION.md](../SUBMISSION.md).

---

## 1. Shared contract and workspace scaffold
- **Date:** 2026-11-14 (commit f03082b)
- **Owner area:** coordinator
- **Asked:** write the shared types (data, mission, engine, API) and the worker protocol before any agent starts, so agents can work in parallel on fixed names.
- **Kept:** the types in `shared/`, the pnpm workspace, the Vite and TypeScript setup.
- **Changed or rejected:** no record of rejected options in the commits. reason: ask Pranay.

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

## 14. Three new practice challenges on real Birmingham problems
- **Date:** 2026-11-14 (not committed yet)
- **Owner area:** challenges (`web/src/challenges/van`, `bills`, `beds`, `common`), data (`web/scripts/prep_challenges.py`)
- **Asked:** real problems in Practice with working solutions.
- **Built:**
  - **Stray-Dog Van Route** (stray dogs, the #1 complaint to 311): plan a route through sample reports on real Downtown and Woodlawn streets. It must be within 5% of the exact best route (Held-Karp). That cutoff was chosen from measurements: report order is 12–111% too long, nearest neighbor passes the samples but fails a hidden test (+5.8%), and nearest neighbor + 2-opt passes all.
  - **Water Bill Check** (the 2026 billing breakdown): flag sample accounts whose bill repeats 3+ months in a row; the accounts are placed in real Census block groups.
  - **Open Bed** (about 400 people unsheltered): give out made-up beds by priority and distance at real community-building locations.
- **Also:**
  - Linked the four other working missions in the Practice list.
  - Added a Solution / My code button beside Reset.
  - Added optional per-challenge page text (legend, flood switch, messages).
- **Verified:** `practice.node.test.ts` runs each harness in real Pyodide. Reference solutions pass every test, starters fail, and common wrong answers are caught. All three challenges were also run in the browser.
- **Not touched:** the City problems seed projects in `web/public/data/city-problems/` (another session is building those).

## 15. Three map-heavy demo challenges and the top-5 order
- **Date:** 2026-11-14 (not committed yet)
- **Owner area:** challenges (`web/src/challenges/leaks`, `grocery`, `flood`), data (`web/scripts/prep_demo_challenges.py`), order (`web/src/data/community.ts`)
- **Asked:** complicated problems with a lot to show in the demo; rank the top 5 by impact and put them first.
- **Built:**
  - **Stop the Leaks:** greedy crew scheduling with a live water-lost counter and moving trucks.
  - **Grocery Gap:** citywide max coverage on 3D block groups.
  - **Flood Cut-Off:** multi-source Dijkstra on 10,502 real street corners, with a heat-map wave replay.
- **Pass thresholds were measured, not guessed:**
  - Leaks: 2.5% (biggest-first is 3–6% over and fails; ratio dispatch is at most 1.4% over).
  - Grocery: 95% of the exact best (top-k-alone reaches 41–55%; greedy reaches 96.6–100%).
- **Fixed after browser testing:**
  - The grocery replay rebuilt every polygon on every frame. It now uses feature-state.
  - The camera ease cancelled the fit.
  - The map helpers were made safe after the map is removed.
- **Verified:** `demo.node.test.ts` (real Pyodide) passes. All 132 web and 69 server tests pass. All three challenges were accepted in the browser with the reference solution.
- **Ranking and reasons:** `docs/top-problems.md`.

## 16. UI prototype, After Dark palette and landing page
- **Date:** 2026-11-14 (commits 72a9f53, 5aa156b, 680fc85, ca776ad, d210f8c, 4ac0b09, 0abe52e)
- **Owner area:** UI prototype (Margulan Baizhakyp), merged into the app by Pranay Joshi
- **Asked:** a new look for the app as a separate prototype with mock data, then port it onto the real app without losing the engine, server or data.
- **Kept:**
  - `web/src/theme.ts` as the single color source. The map lights and base map colors are derived from it.
  - The landing page (its own site on port 5180).
  - Home hero and the Mission screen markup and class names.
- **Changed in the merge:**
  - The prototype's own Pyodide worker, mock data and `App.tsx` stay out of the real app. It keeps its engine, runner and routes.
  - Home camera clears the hero, and the ash-colored residents were made quieter (ca776ad).
  - Code indentation is kept when text is scrubbed, and the Warm Nights note was shortened to fit 1280x720 (9663679).
- **Where each file went:** `docs/ui-integration.md`.

## 17. Route to Fresh Food challenge
- **Date:** 2026-11-14 (commit 5aa156b)
- **Owner area:** `web/src/challenges/route/`, `web/public/data/graph.json`, `route_tests.json`, `web/scripts/prep_data.py`
- **Asked:** a code challenge where the student finds the shortest walk to a grocery store on real Downtown and Woodlawn streets, with flooded streets closed in the second test.
- **Kept:** real OpenStreetMap streets, the correct shortest path stored for each test, visible and hidden tests.
- **Changed:** the challenge was ported to `forwardRef` for React 18 in the real app (`docs/ui-integration.md`).

## 18. Challenges hub and Practice list
- **Date:** 2026-11-14 (commits e5c0428, f817468, 6e11d25)
- **Owner area:** `web/src/pages/ChallengeList.tsx`, `web/src/data/community.ts`
- **Asked:** one page at `/challenges` with the Practice list and the City problems idea, and a Home hero with two doors: Browse challenges and Solve a real city problem.
- **Kept:** the hub, the hero buttons, links to the working missions from the Practice list.
- **Changed:** the hub was merged from the prototype branch (`ui-prototype`) after the After Dark merge. The top-5 order came later (entry 15).

## 19. Sparks, the challenge coach, and map colors
- **Date:** 2026-11-14 (commits 75be74d, 7639323, 21865d7)
- **Owner area:** `web/src/challenges/CoachPanel.tsx`, `server/src/challengeCoach.ts`, `web/src/map/`
- **Asked:** a coach for the challenge screen that gives one hint at a time and never writes the answer, docked inside the code card, and real-world map colors for streets, land use, water and buildings.
- **Kept:** the same hint-only rule as the mission coach (entry 7): the server holds the reference solution and its guard blocks leaks, and a stored hint is the fallback when there is no API key.
- **Changed:** the coach moved from a floating box into the code card (7639323).

## 20. Light mode and mission layout
- **Date:** 2026-11-14 (commits 041dd84, b522fcf, a477027, 14cbcab)
- **Owner area:** `web/src/theme.ts`, `web/src/index.css`, `web/src/mission/`, `web/src/landing/`
- **Asked:** a light theme with enough contrast to read on a projector, missions laid out like challenges (code left, map right), the app on 5173 and the landing page on 5180.
- **Kept:** contrast and color fixes for light mode, and the code-left, map-right mission layout.
- **Fixed:** the landing page was loading the app stylesheet and broke its layout. It now loads its own CSS only (14cbcab).

## 21. City problems: post a problem, solve it as a project, leaderboard
- **Date:** 2026-11-14 (commit 8e8a242)
- **Owner area:** `shared/cityProblems.ts`, `server/src/cityProblems.ts`, `web/src/pages/Workspace.tsx`, `web/src/workspace/`, seed projects in `web/public/data/city-problems/`
- **Asked:** a resident or group posts a problem, the server builds a small Python starter project for it (files, README, tests) with no AI call, a student solves it in a browser workspace, and the best solutions are ranked on a leaderboard.
- **Built:**
  - Four seed problems: Bus Shelters, Storm Drains, Stray Routes, Water Bills. Each has a starter project, and three have reference solutions.
  - A workspace with a file tree, tabs, Output and Tests. **Run** runs `main.py`, **Run tests** runs `tests/test_*.py`, and **Submit** re-runs the problem's own tests and sends the project to the server.
  - Points for a chosen solution and for votes (`POINTS_CHOSEN`, `POINTS_VOTE`), and size limits on projects (`PROJECT_LIMITS`).
- **Safety:** file paths are checked with `isSafePath`, project size is capped, and file and folder paths are checked on submit. Tests are in `server/test/cityProblems.test.ts`.
- **Verified:** typecheck passes, and the web and server tests run in the final check below.

## 22. Submission pass: file headers, submission checklist, demo script
- **Date:** 2026-11-14
- **Owner area:** docs, and header comments only
- **Asked:** check the repo against the Shipt Hacks submission notes, and add what is missing.
- **Added:** `SUBMISSION.md` (what is submitted, the judging criteria mapped to files, open questions), `docs/demo-script.md` (the three-minute demo and the fallback plan), and a plain-words comment at the top of five files that had none (`route/check.ts`, `route/index.tsx`, `route/viz.ts`, `landing/stages/Data.tsx`, `landing/stages/Play.tsx`).
- **Not changed:** no code logic was touched.

## 23. README rewrite with screenshots and diagrams
- **Date:** 2026-11-14
- **Owner area:** `README.md`, `docs/media/`
- **Asked:** after the Shipt Hacks win, a README with more graphics, in the style of a project page but not as detailed.
- **Built:** badges, a landing hero image, eleven screenshots taken from the running app (landing, home, a mission after Run, the challenges hub, three challenges after submitting the reference solution, city problems and the workspace), two Mermaid diagrams (the loop and the architecture), and tables for the stack, AI use and limits.
- **Checked:** every image and link path exists. Every number in the README comes from this repo (207 tests, 7 challenges, 5 missions, 4 city problems, 10,502 street corners).
- **Kept honest:** the README says the leaderboard solvers and sample posters are made up, and repeats the data limits.
