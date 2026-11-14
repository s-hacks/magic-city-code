# Bringing a new UI prototype into the app

The UI prototype (`ui-prototype` branch) is a standalone Vite app with mock data. The real app keeps its own engine, Python runner, data, server and routes, and takes only the prototype's **look and layout**. This page says where each part of the prototype goes, so the next prototype drop is quick to port.

## What maps to what

| Prototype file | Real app | How it is used |
|---|---|---|
| `web/src/theme.ts` | `web/src/theme.ts` | **Copied as is.** Single color source. `applyCssVars` sets CSS variables (called from `AppContext` on day/night). `map/theme.ts` (deck.gl lights) and `map/mapStyle.ts` (base map) derive their colors from it. |
| `web/src/index.css` | `web/src/index.css` | **Copied as is.** Main stylesheet. `styles.css` loads after it and only adds what the prototype lacks (Python status, Sparks question box, report flow, plan comparison, printable proposal). |
| `index.html` head, `public/favicon.svg` | same | Fonts, favicon, theme color. |
| `landing/*` (was `landing.html`) | `landing/*`, route `/` | The first page. Mounted inside the app's router instead of its own HTML entry. `landing.css` uses the app tokens and scopes its resets to `.lp`; the three.js hero reads colors from `theme.ts`. The **Missions** stage lists the real missions (`listMissionSummaries` + `getMission`) and the code challenges, and links to `/mission/:id` or `/challenge/:id`. `facts.ts` stays hand-written and sourced. |
| `pages/Challenge.tsx`, `challenges/*`, `py/*`, `public/data/graph.json`, `route_tests.json` | same, route `/challenge/:id` | **Copied nearly as is.** The prototype editor lives at `challenges/Editor.tsx` (wrapped in `forwardRef` for React 18). Uses `map/style.ts` (plain MapLibre style) and its own Pyodide worker from the CDN. |
| `pages/Home.tsx` | `pages/Home.tsx`, route `/city` | Hero markup and classes. Flares stay deck.gl layers in `MapView`; the hover card uses `.flare-card.is-shown`. |
| `pages/Mission.tsx` | `mission/MissionScreen.tsx`, `MissionPanel.tsx`, `CodePanel.tsx`, `Coach.tsx`, `map/CityMeter.tsx`, `map/Legend.tsx`, `app/TopBar.tsx` | Same markup and class names (`.mission-panel`, `.code-panel`, `.skyline`, `.torch`, `.sparks`, `.legend .chip`, `.pill`). Icons live in `app/icons.tsx`. |
| `map/MapView.tsx` | not used | The real map is MapLibre 4 + deck.gl. Layer groups for the legend toggles are in `map/layerGroups.ts`. |
| `data/mock.ts` | landing "Try it" demo and challenge map center only | |
| `App.tsx`, `code/Editor.tsx`, `package.json`, lockfile, tsconfigs | not used | The real app uses the pnpm workspace, React 18, the engine and the Pyodide runner. The editor takes its colors from the CSS variables. |

## Porting the next prototype

1. Copy `theme.ts` and `index.css` over. Build and look at Home and Mission: most of the new look lands here.
2. If token names changed, update `map/theme.ts` (`build`) and `map/mapStyle.ts` (`lookFor`). Signal colors: gold = lit / hubs, green = grocery stores, orange = problems and need haze, red = errors.
3. For landing changes, copy `landing/` over but keep the Missions stage's data hooks (`useCards`) and the `Link` targets, and re-check that `landing.css` has no unscoped `body`/`p`/`h1` rules.
4. Diff the prototype's `Home.tsx` / `Mission.tsx` markup against the real components in the table and move class or layout changes across. Keep the real data, handlers and state.
5. Delete rules in `styles.css` that the new `index.css` now covers.
6. Run `pnpm -r typecheck` and `pnpm -r test`, then click through Landing → Missions → Mission → Run → Proposal, `/city`, and the challenge at 1280×720 in both themes.
