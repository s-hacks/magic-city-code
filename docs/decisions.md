# Decisions

Each entry gives the choice, what was rejected, and the reason. If the reason is not in the plan, a commit or the conversation, it says "reason: ask the owner".

---

## Stack

### Vite 6, not Vite 7
- **Chosen:** Vite 6 (`web/package.json`: `"vite": "^6"`).
- **Rejected:** Vite 7.
- **Reason:** Vite 7 needs Node 20.19 or newer. This machine has Node 20.17. The plan offers pinning Vite 6 or upgrading Node.

### CodeMirror 6, not Monaco
- **Chosen:** CodeMirror 6 (`web/src/code/Editor.tsx`).
- **Rejected:** Monaco.
- **Reason:** the plan says CodeMirror is lighter and runs well on school Chromebooks.

### Pyodide in a Web Worker
- **Chosen:** real Python (Pyodide 0.27) in a Web Worker, with a 5 s kill.
- **Rejected:** running Python on the server; a custom mini-language in the page.
- **Reason:** the plan says real Python, no server, and isolated from the page. A bad loop cannot freeze the page.

### Actions, not drawing
- **Chosen:** student code returns a list of actions (for example `place_hub`). The engine applies them and computes the result.
- **Rejected:** letting student code draw or change the map directly.
- **Reason:** the plan says this is safe (sandboxed), explainable (one pure function), and makes before/after free. The AI only fills in a mission config and never writes engine code.

### In-memory store, seeded from JSON
- **Chosen:** the plan's choice is an in-memory store seeded from one JSON file.
- **Current state:** the store is still in memory, and it is also saved to `server/data/store.json` (git-ignored) so problems and approved missions survive a server restart while building. `STORE_PERSIST=0` turns this off. The file-backed save came with the first server commit (8f88bff); d7370d3 added the reset.
- **Reason:** the coordinator's brief to server-ai asked for an optional save file. A restart during a rehearsal should not wipe the board. Code review then found that rehearsal data leaks into the live demo, so `/?reset=1`, `POST /api/admin/reset` and `pnpm --filter @mcc/server reset` were added.

### Claude model and effort
- **Chosen:** `claude-opus-5-5` for both the generator (effort `medium`, structured outputs) and the coach (effort `low`, streamed).
- **Rejected:** a cheaper model for the coach. The plan leaves this as a later choice for the team.
- **Reason:** the plan asks for structured outputs for the generator and streaming for the coach.

---

## Engine and data

### Coverage by weighted resident dots, not block-group centers
- **Chosen:** coverage is scored with about 3,000 resident dots, each carrying its need as a weight.
- **Rejected:** scoring at block-group centers.
- **Reason:** center scoring gave threshold artifacts. A new store at the old Save-A-Lot showed 0 gain, because the nearest center was 10.3 minutes away. Dots give a smoother result.
- **Trade-off:** walking times are straight-line estimates, not road routes.

### `existingSources: "none"`
- **Chosen:** a mission can say the existing stores do not count as food sources.
- **Rejected:** always counting grocery stores as sources.
- **Reason:** Wi-Fi spots and warming stations should not be scored against grocery stores.

### Dots spread by households, not by need
- **Chosen:** dots are placed in proportion to households. Need is kept as each dot's weight.
- **Rejected:** placing dots in proportion to need.
- **Reason:** placing by need produced dense diagonal bands in Woodlawn.

### Store buffer outside the city limits
- **Chosen:** supermarkets within 2.5 km of the city line are kept (`STORE_BUFFER_M` in `data/build.py`). Sites and areas stay inside the city.
- **Rejected:** only stores inside the city line.
- **Reason:** residents of edge neighborhoods shop in Midfield, Homewood and Fairfield, just over the line (`data/README.md`). The 2.5 km value was picked by the coordinator. It is about four times the 10-minute walk radius (about 615 m straight-line) and a little more than the 20-minute "longer walk" band. So it keeps every store that could change a resident's color, without pulling in the whole metro area.

### Closed store kept in its own file
- **Chosen:** West End Save-A-Lot (closed Sept 2023) is removed from `stores.json` and written to `former_stores.json`.
- **Rejected:** keeping it on the map as a store.
- **Reason:** the one-store-vs-hubs comparison needs the old site, and the store is closed.

### ACS bulk files, not the Census API
- **Chosen:** ACS 2023 5-year summary files from www2.census.gov.
- **Rejected:** the Census API.
- **Reason:** the API now requires a key (`data/README.md`).

---

## Generated missions

### Calibrate generated missions with real Python and the engine
- **Chosen:** each level's solution and starter code run in real Pyodide in Node, scored by the engine. Target = floor(coverage). A failed level gets one retry, with the errors sent back to Claude.
- **Rejected:** a target typed by the AI.
- **Reason:** the commit says the target should come from Pyodide and the engine. Rounding down guarantees the solution meets its own target. Rounding to the nearest percent could push the target just above what the solution reaches. The seed missions use the same rule.

### Keyword fallback when there is no AI
- **Chosen:** a keyword classifier picks the theme, and a matching seed mission is used.
- **Rejected:** failing when there is no key or the AI errors.
- **Reason:** the plan requires that the app works offline (fallbacks for every AI call).

### Problems with no coverage mission become "needs a new mission type"
- **Chosen:** the card is saved as `needs_new_type`.
- **Rejected:** forcing a coverage mission onto every problem.
- **Reason:** the plan says a problem like "my water bill is wrong" cannot be a coverage mission.

### Level 4 spacing step
- **Chosen:** a "skip sites too close to one already chosen" step in level 4.
- **Rejected:** plain sorting of sites by score.
- **Reason:** plain sorting clustered the picks and scored below the plain loop.

---

## Safety and privacy

### Coach gets the server's own copy of the mission
- **Chosen:** the browser sends a mission id only. The server uses its copy and never sends solutions to the coach.
- **Rejected:** sending the solution from the browser.
- **Reason:** the code review found that solutions reached the coach endpoint. The plan says the coach never gives the solution.

### Approval gate for generated missions
- **Chosen:** a generated mission is not listed or served until an adult approves it. Preview needs `?preview=1`.
- **Rejected:** showing generated missions straight away.
- **Reason:** the plan says a teacher approves a mission before students see it.

### Server listens on 127.0.0.1 only
- **Chosen:** the server binds to `127.0.0.1`. The web app uses Vite's `/api` proxy, so no CORS is needed.
- **Rejected:** listening on all interfaces.
- **Reason:** commit d7370d3 says "localhost only". Code review found that with all interfaces and open CORS, anyone on the venue Wi-Fi could post problems to the projected board, spend the API key through `/generate`, or approve missions. Judges watch the team's laptop only, so nothing needs to reach the server from another machine.

### Names and contact details scrubbed from resident and student text
- **Chosen:** names, phone numbers, emails and addresses are removed before text is saved or sent to Claude.
- **Reason:** the plan's privacy section (17) and the server README.

### Honesty note for Warm Nights
- **Chosen:** Warm Nights counts seniors and low-income households. The app says there is no public data on where people sleeping outside are.
- **Rejected:** counting unsheltered people, which no public data covers.
- **Reason:** the showcase doc records this as the honest limit. The on-screen note is in `web/src/mission/MissionPanel.tsx`.

### Proposals carry a plain label
- **Chosen:** a proposal page says it is based on public data and is a starting point for discussion, not an engineering study.
- **Reason:** the plan's "Should" tier, and the plan's note on honest labels.

---

## Demo

### Hidden demo keys
- **Chosen:** Ctrl+Shift+1/2/3 types a level's prepared solution. Hold B to compare. D switches day and night. Ctrl+Enter or Cmd+Enter runs code.
- **Reason:** the demo must run under stage lights without typing. Students do not see the keys.

### Demo reset
- **Chosen:** `/?reset=1` clears the browser's saved state. `POST /api/admin/reset` (localhost only) resets the server.
- **Reason:** the server README says a reset before a demo must remove runtime problems, missions and proposals.
