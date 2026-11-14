# Magic City Code server

Node + Express. It turns residents' problems into missions, streams hints from Sparks the coach, and keeps the problem board and student proposals. The Claude API key lives only here.

## Run it

```bash
pnpm install                       # once, at the repo root
pnpm --filter @mcc/server dev      # watch mode; or: cd server && npx tsx src/index.ts
```

The server listens on `http://127.0.0.1:8787`, so only this computer can reach it. The web app talks to it through Vite's `/api` proxy, so it needs no CORS.

When the server starts, Python (Pyodide) begins loading in the background, which takes about 1.5 s. It is used to check generated missions.

## Settings (`.env` at the repo root)

| Variable | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Turns on the AI. Server only. Never put it in `web/`. Without it, everything still works on the fallbacks. |
| `PORT` | Default `8787`. |
| `AI_DISABLED=1` | Forces the fallbacks even when a key is set. Use it to rehearse the demo offline. |
| `STORE_PERSIST=0` | Keep everything in memory only. By default the store is saved to `server/data/store.json`, which git ignores. |
| `GENERATOR_MODEL`, `COACH_MODEL` | Override the model. The default for both is `claude-opus-5-5`. |

## Routes

| Route | What it does |
|---|---|
| `GET /api/health` | `{ ok, ai }` |
| `GET /api/problems`, `POST /api/problems` | The problem board. Text is scrubbed of names, phone numbers, emails and addresses. |
| `POST /api/missions/generate` | Resident text → mission (see below). The mission starts unapproved. |
| `GET /api/missions` | Approved missions only. |
| `GET /api/missions/:id` | 403 `{ error: "not approved" }` for an unapproved mission, unless `?preview=1`. |
| `POST /api/missions/:id/approve` | An adult approves the mission. Only now does its problem card show `status: "mission"` and a `missionId`. |
| `POST /api/coach` | Streams one hint as `text/plain`. The server uses its own copy of the mission by `missionId`. |
| `GET/POST /api/proposals`, `GET /api/proposals/:id` | Student proposals. The name is cut to the first word; code and summary are scrubbed. |
| `GET /api/city-problems` | City problem cards (no starter or solutions, plus `solutionCount`): posted ones newest first, then the samples in `index.json` order. |
| `GET /api/city-problems/:id` | The full problem with its starter project. Solutions: chosen first, then most votes. |
| `POST /api/city-problems` | Post a problem → 201 `{ problem, posterKey }`. Text is scrubbed, `postedBy` cut to the first word. The server builds the starter (`README.md`, `main.py`, `tests/test_main.py`, attached files under `data/`). Only the key's sha256 is stored. |
| `POST /api/city-problems/:id/solutions` | Submit a project → 201 solution. Checked against `PROJECT_LIMITS`, safe paths and at least one `.py` file. Code is scrubbed. 409 once Solved; Open becomes Reviewing. |
| `POST /api/city-problems/:id/solutions/:sid/vote` | `{ voterId }` → `{ votes }`. One vote per voter per solution. |
| `GET /api/city-problems/:id/review` | Header `x-poster-key` → `{ canReview }`. |
| `POST /api/city-problems/:id/solutions/:sid/choose` | Header `x-poster-key` → the Solved problem. The poster's key, or this computer for the sample problems; otherwise 403. |
| `GET /api/leaderboard` | Top 10: carried-over points + 300 per chosen solution + 10 per vote, by name and school. |
| `POST /api/admin/reset` | Back to the seed state (localhost only), city problems, votes and keys included. See "Demo reset". |

## How missions are made, and the fallbacks

1. The resident's text is scrubbed.
2. **With AI:** Claude (`claude-opus-5-5`, effort `medium`, structured outputs) fills in a mission draft. The server adds the id, the map box and the quote, then checks it:
   - the schema is valid;
   - the neighborhood exists;
   - the area has at least one block group and 3 or more candidate sites;
   - the levels make sense;
   - the code looks like Python.
3. **Calibration:** each level's starter code and answer code run in real Pyodide (`web/src/code/city.py`) and are scored by the real engine (`web/src/engine`).
   - The goal is set to the answer's coverage, rounded down to a whole percent.
   - A level fails if its code errors, if the answer doesn't beat the "before" score, or if the starter code already wins.
   - Each Python run has a 3 s limit.
4. A failed check gets one retry, with the errors sent back to Claude. Both attempts together have a 25 s deadline.
5. **Fallback**, used with no key, `AI_DISABLED=1`, no network, a timeout, or two failed attempts:
   - A keyword sorter picks the theme: food, farm stand, transit, homework, kids, warming, seniors, or "needs a new mission type" for bills, potholes and the like.
   - The matching seed mission in `web/public/data/missions/` is used.
   - If the resident asked for another neighborhood, the seed is moved there, its named sites are swapped for local ones, and it is calibrated.
   - Otherwise a built-in template is used.
6. If the problem isn't a "place things so people can walk to one" problem, the card is saved as `needs_new_type`.

**Coach:** Claude (`claude-opus-5-5`, effort `low`, streamed) gives one hint of at most 3 sentences. It escalates nudge → idea → worked example on a different problem.
- It never gets the level's solution.
- A guard stops the stream if the reply repeats solution lines.
- The student's code and question are scrubbed first.
- If nothing arrives within 8 s, there is no key, or there is an error, the coach sends the level's stored hint instead.

## Demo reset

```bash
pnpm --filter @mcc/server reset                    # deletes server/data/store.json, and resets a running server too
curl -X POST http://127.0.0.1:8787/api/admin/reset   # resets a running server (localhost only)
```

Both remove every problem, mission, proposal, city problem, solution and vote added at runtime. The seed files are left as they are.

## Try and test

```bash
npx tsx scripts/try-generate.ts --offline                # the five showcase problems + "My water bill is wrong", no AI
npx tsx scripts/try-generate.ts --first 2                # with AI (uses API calls)
npx tsx scripts/try-generate.ts --offline --neighborhood ensley   # shows seeds moved to another neighborhood
npx tsc -p . && npx vitest run
```
