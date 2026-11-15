<h1 align="center">Magic City Code</h1>

<p align="center"><strong>Magic City Code helps students learn to code by fixing real Birmingham city problems.</strong></p>

<p align="center">
  <img alt="Shipt Hacks: 1st place" src="https://img.shields.io/badge/Shipt%20Hacks-1st%20place-f5b800?style=flat-square">
  <img alt="Python in the browser" src="https://img.shields.io/badge/Python-Pyodide-3776ab?style=flat-square">
  <img alt="React 18 and TypeScript" src="https://img.shields.io/badge/React%2018-TypeScript-3178c6?style=flat-square">
  <img alt="3D map: MapLibre and deck.gl" src="https://img.shields.io/badge/3D%20map-MapLibre%20%2B%20deck.gl-7c4dff?style=flat-square">
  <img alt="AI: Claude" src="https://img.shields.io/badge/AI-Claude-d97757?style=flat-square">
  <img alt="207 tests passing" src="https://img.shields.io/badge/tests-207%20passing-2ea44f?style=flat-square">
</p>

<p align="center"><img src="docs/media/landing-hero.jpg" alt="The Magic City Code landing page: Kids code the fix for their own city, over a 3D night view of Birmingham" width="860"></p>

<p align="center">
  <a href="#the-idea">The idea</a> ·
  <a href="#see-it">See it</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#where-ai-is-used">AI</a> ·
  <a href="#tech-stack">Tech stack</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#data-and-honest-limits">Data</a> ·
  <a href="#team">Team</a>
</p>

---

## The idea

Kids learn to code on games about made-up worlds. Birmingham has real problems: about 70% of residents live in a food desert, the water utility loses about half its water revenue to leaks and unbilled use, and about a third of the city's 27,000 storm drains need repair.

Magic City Code turns those problems into coding levels. A resident reports a problem, AI turns it into a mission on a 3D night map of the real city, a student solves it with a few lines of Python, and the result goes back to the community as a proposal.

> **Student code never draws anything.** It returns a list of actions. One pure engine scores them, so the map is safe, the answer is always the same for the same input, and before/after compare comes for free. AI writes mission text and hints. It never writes engine code and never gives the answer.

<table align="center">
<tr>
<td align="center"><strong>7</strong><br><sub>coding challenges</sub></td>
<td align="center"><strong>5</strong><br><sub>map missions</sub></td>
<td align="center"><strong>4</strong><br><sub>city problem projects</sub></td>
<td align="center"><strong>207</strong><br><sub>passing tests</sub></td>
<td align="center"><strong>0</strong><br><sub>student code run on a server</sub></td>
<td align="center"><strong>0</strong><br><sub>AI calls without a fallback</sub></td>
</tr>
</table>

## See it

### 1. Pick a problem on the night map

Every dot is a household. Every flare is a real problem a neighbor reported.

<p align="center"><img src="docs/media/home.jpg" alt="The home screen: a 3D night map of Birmingham with glowing resident dots and orange problem flares" width="860"></p>

### 2. Write a few lines of Python and light up the city

The mission screen has the story on the left, your code under it, and the map on the right. Press Run, and the households within a ten-minute walk of your stop turn gold. Hold **B** to compare with the city today.

<p align="center"><img src="docs/media/mission.jpg" alt="The Farm Stand Route mission: one line of Python placed a stop and lit up 38% of Woodlawn" width="860"></p>

### 3. Practice on real data

Seven challenges run on real Birmingham data, with hidden tests and a map replay of your answer.

<p align="center"><img src="docs/media/challenges.jpg" alt="The challenges hub: Stop the Leaks, Grocery Gap, Open Bed and Flood Cut-Off, with skills and difficulty" width="860"></p>

<table>
<tr>
<td width="33%"><img src="docs/media/grocery-gap.jpg" alt="Grocery Gap: choosing new grocery store sites so the most families without a car are within a mile"><br><sub><strong>Grocery Gap.</strong> Greedy max coverage. Choose store sites so the most households without a car are within a mile.</sub></td>
<td width="33%"><img src="docs/media/stop-the-leaks.jpg" alt="Stop the Leaks: dispatching repair crews with a live water-lost counter"><br><sub><strong>Stop the Leaks.</strong> Greedy scheduling. Dispatch crews so the fewest gallons pour away.</sub></td>
<td width="33%"><img src="docs/media/flood-cutoff.jpg" alt="Flood Cut-Off: a heat map of walking time to shelter across 10,502 street corners"><br><sub><strong>Flood Cut-Off.</strong> Multi-source Dijkstra over 10,502 real street corners.</sub></td>
</tr>
</table>

The full list, ranked by impact, is in [docs/top-problems.md](docs/top-problems.md): Stop the Leaks, Grocery Gap, Open Bed, Flood Cut-Off and Water Bill Check, then Route to Fresh Food, Stray-Dog Van Route and Feed the Block.

### 4. Solve problems posted by neighbors

A neighbor posts a problem with its data. Coders open it as a small Python project, with files, a README and tests, then run the tests and submit. The poster picks the solution that works.

<table>
<tr>
<td width="50%"><img src="docs/media/city-problems.jpg" alt="The City problems tab: problems posted by neighbors and the season leaderboard"><br><sub><strong>City problems.</strong> Problems from neighbors and a season leaderboard. The sample posters and solvers are made up.</sub></td>
<td width="50%"><img src="docs/media/workspace.jpg" alt="The workspace: file tree, README, test results and a live map preview for the storm drains problem"><br><sub><strong>Workspace.</strong> File tree, editor, Run tests, Submit and a live map of your picks.</sub></td>
</tr>
</table>

### 5. The story, on the landing page

<table>
<tr>
<td width="50%"><img src="docs/media/landing-loop.jpg" alt="The landing page loop stage: six steps from a resident's report to a proposal"><br><sub><strong>The loop.</strong> From a neighbor's complaint to a kid's proposal, in six steps.</sub></td>
<td width="50%"><img src="docs/media/landing-data.jpg" alt="The landing page data stage: Birmingham's problems with sourced numbers"><br><sub><strong>The city.</strong> Six real problems, each with a sourced number.</sub></td>
</tr>
</table>

## How it works

```mermaid
flowchart LR
    A["Resident reports a problem"] --> B["Names and phone numbers removed"]
    B --> C["Claude writes a mission<br/>(or a seed mission if AI is off)"]
    C --> D["Student writes Python"]
    D --> E["Python returns a list of actions"]
    E --> F["simulate(mission, actions)<br/>one pure function"]
    F --> G["Map lights up, score updates"]
    G --> H["Proposal goes back to the community"]
```

### Architecture

```mermaid
flowchart TB
    subgraph Browser
        UI["React app<br/>missions, challenges, workspace"]
        MAP["MapLibre + deck.gl<br/>3D night map"]
        ED["CodeMirror editor"]
        PY["Pyodide in a Web Worker<br/>5 second limit"]
        ENG["Engine<br/>simulate()"]
        UI --- MAP
        UI --- ED
        ED --> PY
        PY -- "actions" --> ENG
        ENG -- "metrics" --> MAP
    end
    subgraph Server["Server (127.0.0.1 only)"]
        API["Express + Zod"]
        GEN["Mission generator"]
        COACH["Coach: Sparks"]
        STORE["In-memory store"]
        API --- GEN
        API --- COACH
        API --- STORE
    end
    DATA[("City JSON<br/>Census + OpenStreetMap")]
    CLAUDE{{"Claude API"}}
    UI <-- "/api" --> API
    DATA --> UI
    GEN -. "key stays here" .-> CLAUDE
    COACH -. "key stays here" .-> CLAUDE
```

### Why it is built this way

| Choice | What it gives |
|---|---|
| Python returns **actions**, not drawings | Safe to run, easy to explain, same input gives the same answer |
| Real Python in a **Web Worker**, 5 second kill | A bad loop cannot freeze the page, and no student code runs on a server |
| Coverage scored with **weighted resident dots** | Fixes the threshold errors of block-group centers |
| Mission targets set by **the real engine**, not by AI | A generated mission can never be unwinnable |
| Challenge pass marks **measured** from common wrong answers | A correct answer never fails on stage |
| The server listens on **127.0.0.1** only | Nobody on the venue Wi-Fi can reach it |

Every choice and what was rejected is in [docs/decisions.md](docs/decisions.md).

## Where AI is used

| Where | What it does | What it may not do |
|---|---|---|
| **Mission generator** | Turns a resident's words into a mission config, checked by a schema, with one retry | Write engine code, or set the score target |
| **Coach (Sparks)** | Gives one hint at a time, streamed | Give the solution. A leak guard cuts off any reply that starts repeating it |
| **Claude Code subagents** | Built the app, one folder each (see below) | Skip review. A reviewer agent found and fixed real bugs |

Every AI call has a fallback: no key, a timeout or a bad reply falls back to a seed mission, a keyword classifier or a stored hint. The app works fully offline. Names, phone numbers, emails and addresses are removed before any text is saved or sent to Claude, and an adult approves a generated mission before students see it.

What AI wrote, what was kept and what was rejected is logged in [docs/ai-log.md](docs/ai-log.md).

## Tech stack

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React%2018-20232a?style=flat-square&logo=react">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite%206-646cff?style=flat-square&logo=vite&logoColor=white">
  <img alt="MapLibre" src="https://img.shields.io/badge/MapLibre%20GL-396cb2?style=flat-square">
  <img alt="deck.gl" src="https://img.shields.io/badge/deck.gl%209-222?style=flat-square">
  <img alt="three.js" src="https://img.shields.io/badge/three.js-000?style=flat-square&logo=threedotjs">
  <img alt="Pyodide" src="https://img.shields.io/badge/Pyodide%200.27-3776ab?style=flat-square&logo=python&logoColor=white">
  <img alt="CodeMirror" src="https://img.shields.io/badge/CodeMirror%206-d30707?style=flat-square">
  <img alt="Node and Express" src="https://img.shields.io/badge/Node%2020-Express-5fa04e?style=flat-square&logo=nodedotjs&logoColor=white">
  <img alt="Zod" src="https://img.shields.io/badge/Zod-3068b7?style=flat-square">
  <img alt="Claude API" src="https://img.shields.io/badge/Claude%20API-d97757?style=flat-square">
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-6e9f18?style=flat-square&logo=vitest&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm%20workspaces-f69220?style=flat-square&logo=pnpm&logoColor=white">
</p>

| Layer | Choice | Why |
|---|---|---|
| App | React 18, TypeScript, Vite 6 | Fast to build. Vite 7 needs Node 20.19, so we pinned Vite 6 |
| 3D map | MapLibre GL, OpenFreeMap tiles | Free, no API key, real building footprints |
| Data layers | deck.gl | Draws thousands of glowing resident dots smoothly |
| Student code | Pyodide (real Python) in a Web Worker | No server runs student code, and a bad loop cannot freeze the page |
| Editor | CodeMirror 6 | Lighter than Monaco, runs well on school Chromebooks |
| Server | Node 20, Express, Zod | One language across the app, and Zod checks every AI response |
| AI | Claude API through `@anthropic-ai/sdk` | Structured output for missions, streaming for the coach |
| Data | Python scripts: Census ACS files, OpenStreetMap | Run once, written to plain JSON |

## Quick start

```bash
pnpm install
cp .env.example .env        # optional: add ANTHROPIC_API_KEY. The app works offline without it.
pnpm dev
```

Needs Node 20.17 or newer and pnpm 9. `pnpm dev` runs the web app, the landing page and the server in parallel (`pnpm dev:app` skips the landing page). Open **http://localhost:5173** for the app. The landing page is a separate site on **http://localhost:5180**; its links go to the app (set `VITE_APP_URL` to point them somewhere else).

Demo shortcuts:
- **Ctrl+Shift+1 / 2 / 3** types the prepared solution for level 1, 2 or 3.
- **Hold B** to compare the city today with your plan.
- **D** switches day and night maps.
- **⌘/Ctrl+Enter** runs your code.
- Visit **http://localhost:5173/?reset=1** to clear saved state before a demo.

### Tests

```bash
pnpm -r typecheck
pnpm -r test        # 207 tests: 138 web, 69 server
```

The challenge tests run every reference solution and every starter in real Pyodide. Solutions must pass, starters must fail, and known wrong answers must be caught.

## Repo layout

| Folder | What it holds |
|---|---|
| `web/` | The React app: 3D map, Python editor and worker, missions, challenges, workspace, landing page |
| `server/` | Express server: mission generator, coach, proposals, city problems, fallbacks. The Claude key lives only here. See [server/README.md](server/README.md) |
| `shared/` | Types shared by web and server |
| `data/` | Offline pipeline that writes the city JSON. See [data/README.md](data/README.md) |
| `docs/` | Plans, the AI log, the decisions record, the demo script, and the screenshots in `docs/media/` |
| `reports/`, `research_notes/` | The research behind the problems |
| `.claude/agents/` | The Claude Code subagent role files used to build the app |

Docs: [SUBMISSION.md](SUBMISSION.md) · [docs/demo-script.md](docs/demo-script.md) · [docs/implementation-plan.md](docs/implementation-plan.md) · [docs/ui-plan.md](docs/ui-plan.md) · [docs/ui-integration.md](docs/ui-integration.md) · [docs/showcase-examples.md](docs/showcase-examples.md) · [docs/top-problems.md](docs/top-problems.md) · [docs/ai-log.md](docs/ai-log.md) · [docs/decisions.md](docs/decisions.md)

## Data and honest limits

- **City boundary and block groups:** US Census TIGERweb.
- **Households, no-vehicle households, under 18, 65+, poverty and no internet:** ACS 2023 5-year summary files.
- **Stores, sites and community places:** OpenStreetMap, through Overpass.
- **Neighborhoods:** the city's official neighborhood layer.

Limits we state on screen and here:
- Walking times are straight-line estimates, not road routes.
- Counts are households, not people.
- OpenStreetMap store coverage may be incomplete, especially in west Birmingham.
- There is no public data on where people sleeping outside are. Warm Nights counts seniors and low-income households instead, and the app says so.
- Open Bed and the sample city problems use made-up people, neighbors and data. Never real client data.
- The leaderboard solvers are made up.

## Built with Claude Code subagents

The app was built by Claude Code subagents, each owning one folder, with a reviewer agent checking the work.

| Agent | Owned |
|---|---|
| data-prep | `data/` pipeline |
| engine-builder | `web/src/engine/` |
| python-sandbox | Pyodide worker, editor, plain-words errors |
| server-ai | `server/`: generator, coach, fallbacks |
| map-visuals | 3D map and deck.gl layers |
| mission-content | the five showcase missions |
| mission-ui | the screens |
| code-reviewer | review and fix batches |
| demo-qa | demo runs and bug reports |
| docs-scribe | the AI log and decisions record |

## Team

| Who | Area |
|---|---|
| Pranay | Backend, challenges and tests: `server/`, `shared/`, `data/`, the engine, `web/src/challenges/`, the test suites |
| Margulan | Frontend and research: screens, map, landing page, editor, `reports/`, `research_notes/` |

Full folder ownership and the explain-back plan: [SUBMISSION.md](SUBMISSION.md).

Built for **Shipt Hacks** in Birmingham, Alabama, where it won first place.
