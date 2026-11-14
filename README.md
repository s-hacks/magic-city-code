# Magic City Code

Kids learn to code by fixing their own city. A resident reports a real Birmingham problem, AI turns it into a coding mission on a 3D night map of the real city, a student solves it with a few lines of Python, and the result goes back to the community as a proposal. The student's code only returns a list of actions; a pure engine scores them, so the map is safe, and the answer is always the same for the same input.

## Quick start

```bash
pnpm install
cp .env.example .env        # optional: add ANTHROPIC_API_KEY. The app works offline without it.
pnpm dev
```

`pnpm dev` runs the web app, the landing page and the server in parallel (`pnpm dev:app` skips the landing page). The web app's `predev` step copies Pyodide into `web/public/pyodide/` first.

Open **http://localhost:5173** for the app. The landing page is a separate site on **http://localhost:5180**; its links go to the app (set `VITE_APP_URL` to point them at a deployed app).

Demo shortcuts:
- **Ctrl+Shift+1 / 2 / 3** types the prepared solution for level 1, 2 or 3.
- **Hold B** to compare the city today with your plan.
- **D** switches day and night maps.
- **⌘/Ctrl+Enter** runs your code.
- Before a demo, visit **http://localhost:5173/?reset=1** to clear saved state.

## Tests

```bash
pnpm -r test
```

## Repo layout

| Folder | What it holds |
|---|---|
| `web/` | The React app: the 3D map, the Python editor and worker, the mission screens. |
| `server/` | Express server: mission generator, coach, proposals, fallbacks. The Claude key lives only here. See [server/README.md](server/README.md). |
| `shared/` | Types shared by web and server: data, missions, engine, API shapes. |
| `data/` | Offline pipeline that writes the city JSON. See [data/README.md](data/README.md). |
| `docs/` | Plans, the AI authorship log and the decisions record. See below. |
| `reports/`, `research_notes/` | Research behind the problems used in the missions. |
| `.claude/agents/` | The Claude Code subagent role files used to build the app. |

Docs:
- [SUBMISSION.md](SUBMISSION.md): what is submitted, the judging criteria mapped to files, open questions.
- [docs/demo-script.md](docs/demo-script.md): the three-minute demo and the fallback plan.
- [docs/ui-integration.md](docs/ui-integration.md): how the UI prototype maps onto the app.
- [docs/implementation-plan.md](docs/implementation-plan.md): the plan, scope and judging notes.
- [docs/ui-plan.md](docs/ui-plan.md): screen plan.
- [docs/showcase-examples.md](docs/showcase-examples.md): the five showcase missions and their results.
- [docs/ai-log.md](docs/ai-log.md): what AI wrote or changed, and what was kept or rejected.
- [docs/decisions.md](docs/decisions.md): the major choices, and what was rejected.

## Data sources and their limits

- **City boundary and block groups:** US Census TIGERweb.
- **Households, no-vehicle households, under 18, 65+, poverty and no internet:** ACS 2023 5-year summary files.
- **Stores, sites and community places:** OpenStreetMap (via Overpass).
- **Neighborhoods:** the city's official neighborhood layer.

Honest limits:
- Walking times are straight-line estimates, not road routes.
- Counts are households, not people.
- OSM store coverage may be incomplete, especially in west Birmingham.
- There is no public data on where people sleeping outside are. Warm Nights counts seniors and low-income households instead, and the app says so.

## Agent roster

The app was built by Claude Code subagents. Each one owned one folder.

| Agent | Model | Owned |
|---|---|---|
| data-prep | Sonnet | `data/` pipeline |
| engine-builder | Opus | `web/src/engine/` |
| python-sandbox | Sonnet | Pyodide worker, editor, plain-words errors |
| server-ai | Opus | `server/`: generator, coach, fallbacks |
| map-visuals | Opus | 3D map and deck.gl layers |
| mission-content | Sonnet | the five showcase missions |
| mission-ui | Sonnet | the four screens |
| code-reviewer | Opus | review and fix batches |
| demo-qa | Sonnet | demo runs and bug reports |
| docs-scribe | Haiku | `docs/ai-log.md`, `docs/decisions.md`, this README |

Role files are in `.claude/agents/`.
