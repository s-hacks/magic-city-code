# Magic City Code — web app

React + TypeScript + Vite. MapLibre for the 3D map, CodeMirror for the editor, Pyodide (Python in a Web Worker) for student code.

## Run it

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

Needs internet: map tiles come from OpenFreeMap and Python from the Pyodide CDN (first load ~10 s, then cached).

## Route to Fresh Food (code challenge)

Home → **Code challenge: Long walk to groceries**. Students write `shortest_path(graph, start, goal)` on the real downtown + Woodlawn walking network.

- **Run** = 2 visible tests, replayed on the map: blue = corners your code explored, orange = corners explored again, gold = your route.
- **Submit** = visible + hidden tests (flooded underpasses, start = goal, an unreachable store). After 2 failed submits you can show the best route as a ghost line.
- **Flood mode** closes Birmingham's railroad underpasses and reruns.
- Checks stop at the first failure and show it on the map: crash, timeout, wrong type/empty, wrong start/end, "no street here", flooded street, longer than optimal.
- Keys (outside the editor): `R` run · `S` submit · `F` flood · `Space` play/pause · `1` load the solution (demo) · `0` reset · `⌘↵` run from the editor.

### Rebuild the data

```bash
cd web
uv run --python 3.12 --with osmnx --with networkx scripts/prep_data.py
```

Writes `public/data/graph.json` (`{nodes: {id: [lat, lon]}, edges: [[u, v, meters, geom?]]}`) and `public/data/route_tests.json` (places, flood closures, tests with the correct shortest paths from networkx). OSM responses are cached in `scripts/.osmnx-cache`.

## Adding a challenge

A challenge is one folder in `src/challenges/<name>/` implementing `Challenge` from `src/challenges/types.ts`:

| Piece | Route example |
|---|---|
| description, starter code, solution | `route/index.tsx` |
| data loader (+ raw data handed to Python) | `route/index.tsx` → `load()` |
| Python harness: wraps inputs, traces events, defines `__run` | `route/harness.py` |
| tests + checker | `route/check.ts` |
| map visualizer (replay + failure marks) | `route/viz.ts` |

Register it in `src/challenges/index.ts`. The page (`src/pages/Challenge.tsx`) and the Python worker (`src/py/`) are shared.

### How tracing works

`harness.py` passes the student a `dict` subclass that logs an *expand* on every `graph[node]`, and swaps `heapq.heappush/heappop` for versions that log *push/pop*. Each event records the student's current line (from the call stack), so scrubbing the timeline highlights the matching line. Each test stops itself after 3 s; the worker is killed and restarted if code hangs without touching the graph.
