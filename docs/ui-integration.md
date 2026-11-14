# Bringing a new UI prototype into the app

The UI prototype (`ui-prototype` branch) is a standalone Vite app with mock data. The real app keeps its own engine, Python runner, data, server and routes, and takes only the prototype's **look and layout**. This page says where each part of the prototype goes, so the next prototype drop is quick to port.

## What maps to what

| Prototype file | Real app | How it is used |
|---|---|---|
| `web/src/theme.ts` | `web/src/theme.ts` | **Copied as is.** Single color source. `applyCssVars` sets CSS variables (called from `AppContext` on day/night). `map/theme.ts` (deck.gl lights) and `map/mapStyle.ts` (base map) derive their colors from it. |
| `web/src/index.css` | `web/src/index.css` | **Copied as is.** Main stylesheet. `styles.css` loads after it and only adds what the prototype lacks (Python status, Sparks question box, report flow, plan comparison, printable proposal). |
| `index.html` head, `public/favicon.svg` | same | Fonts, favicon, theme color. |
| `pages/Home.tsx` | `pages/Home.tsx` | Hero markup and classes. Flares stay deck.gl layers in `MapView`; the hover card uses `.flare-card.is-shown`. |
| `pages/Mission.tsx` | `mission/MissionScreen.tsx`, `MissionPanel.tsx`, `CodePanel.tsx`, `Coach.tsx`, `map/CityMeter.tsx`, `map/Legend.tsx`, `app/TopBar.tsx` | Same markup and class names (`.mission-panel`, `.code-panel`, `.skyline`, `.torch`, `.sparks`, `.legend .chip`, `.pill`). Icons live in `app/icons.tsx`. |
| `map/style.ts`, `map/MapView.tsx` | not used | The real map is MapLibre 4 + deck.gl. Layer groups for the legend toggles are in `map/layerGroups.ts`. |
| `data/mock.ts`, `App.tsx`, `code/Editor.tsx`, `package.json`, lockfile, tsconfigs | not used | The real app uses the pnpm workspace, React 18, the engine and the Pyodide runner. The editor takes its colors from the CSS variables. |

## Porting the next prototype

1. Copy `theme.ts` and `index.css` over. Build and look at Home and Mission: most of the new look lands here.
2. If token names changed, update `map/theme.ts` (`build`) and `map/mapStyle.ts` (`lookFor`).
3. Diff the prototype's `Home.tsx` / `Mission.tsx` markup against the real components in the table and move class or layout changes across. Keep the real data, handlers and state.
4. Delete rules in `styles.css` that the new `index.css` now covers.
5. Run `pnpm -r typecheck` and `pnpm -r test`, then click through Home → Mission → Run → Proposal at 1280×720 in both themes.
