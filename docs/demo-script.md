# Demo script

Judges watch the team's laptop only. No hosting, no login, no phone layout. The plan's three-minute flow is in [implementation-plan.md](implementation-plan.md) section 18. This page is the step-by-step version for the current app.

## Before you go on

1. `pnpm install`, then `cp .env.example .env` and add `ANTHROPIC_API_KEY` (optional: the app works offline without it).
2. `pnpm dev`. Wait for the Pyodide copy and both servers.
3. Open **http://localhost:5173/?reset=1** once to clear saved state, then close the reset tab.
4. Open the landing page at **http://localhost:5180** in a second tab.
5. Click through each stop below once. The map tiles and Pyodide are cached after the first load.
6. Have the backup video open in another window (see below).

## The three minutes

| Time | Show | Say |
|---|---|---|
| 0:00 | Landing page (5180) | Kids learn to code on made-up worlds. Birmingham has real problems they could solve. |
| 0:20 | Home (5173): fly-in over the night map | Each light is a resident. Red means far from food. |
| 0:40 | Pick a problem card (or type one on Report). The mission appears | AI turns the resident's words into a mission. It only fills in a config. It never writes the engine. |
| 1:10 | Mission screen: **Ctrl+Shift+1**, then **Run** | Five lines of Python. The student's code returns a list of actions. The engine scores them. |
| 1:40 | Hold **B** | Before and after. The same input always gives the same answer. |
| 1:55 | Open `/challenges`: run **Route to Fresh Food** or **Stray-Dog Van Route** with the solution | Real Birmingham data and hidden tests, not just a score. |
| 2:15 | Proposal page | The result goes back to the resident and a named partner. It says it is based on public data. |
| 2:35 | `/challenges`, City problems tab | Residents post problems. Students solve them as small projects. The leaderboard shows who helped. |
| 2:50 | Close | Who owns which part, what AI wrote and what we rejected (`docs/ai-log.md`, `docs/decisions.md`), and what is next. |

## If something goes wrong

| Problem | Do this |
|---|---|
| Map tiles fail | Use the phone hotspot, or play the backup video. |
| AI is slow or offline | Nothing to do. Every AI call has a stored fallback, so the mission still appears. |
| Typo while coding | **Ctrl+Shift+1 / 2 / 3** types the prepared solution for the level. |
| Map looks washed out on the projector | Press **D** for the day map, or use the light theme. |
| The app is in a bad state | `/?reset=1`, and `pnpm --filter @mcc/server reset` for the server. |

## Backup video

Record the full three minutes with the real app before the deadline and keep it on the laptop (not only online). Put the file name here when it exists: **TODO: add file name**.
