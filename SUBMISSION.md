# Shipt Hacks submission: Magic City Code

Kids learn to code by fixing their own city. A resident reports a real Birmingham problem, AI turns it into a coding mission on a 3D night map, a student solves it in Python, and the result goes back as a proposal.

## What is submitted

| Item | Status | Where |
|---|---|---|
| GitHub repository | Done | https://github.com/s-hacks/shipt-hackathon (judges should open `main`) |
| Live demo | Runs on the team's laptop (judges watch it; no hosting, no login, no phone layout) | [docs/demo-script.md](docs/demo-script.md) |
| Backup demo video | **TODO: record and add the file name** | [docs/demo-script.md](docs/demo-script.md) |
| Format beyond repo and demo (Devpost page, written summary, deadline) | **Unconfirmed. Ask an organizer.** | See Open questions |

The repo and demo requirement is taken from the program slides. The official rules are not in this repo.

## Run it

```bash
pnpm install
cp .env.example .env     # optional: add ANTHROPIC_API_KEY. Works offline without it.
pnpm dev                 # app on http://localhost:5173, landing page on http://localhost:5180
pnpm -r test             # 201 tests: 132 web, 69 server
pnpm -r typecheck
```

Node 20.17 or newer and pnpm 9. More in the [README](README.md).

## How it matches the judging criteria

| Criterion | Where to look |
|---|---|
| **Creativity & Originality** | Real resident problems become coding levels in the students' own city: the Report screen, the generator in `server/src/generator.ts`, and the City problems tab on `/challenges`. |
| **Technical Implementation** | One pure engine (`web/src/engine/`) with tests. Python runs in a sandboxed worker with a 5 s limit. Every AI call has a fallback (`server/src/`). Reference solutions run in real Pyodide in `practice.node.test.ts` and `demo.node.test.ts`. |
| **Code Authorship** | [docs/ai-log.md](docs/ai-log.md) records what AI wrote, what was kept and what was rejected. Each file starts with a plain-words comment. Part owners are listed below. |
| **User Experience & Design** | A mission screen with a big Run button, plain-word errors, hold-B before/after compare, day and night maps, light theme. Screen plan: [docs/ui-plan.md](docs/ui-plan.md). |
| **Problem-Solving & Value** | Real Birmingham data (Census, OpenStreetMap, 311 research) in [data/README.md](data/README.md) and `reports/`. A named partner for each mission. Proposals are labeled as based on public data. Honest limits are in the README. |
| **Reasoning & Explanation** | [docs/decisions.md](docs/decisions.md) records each choice and what was rejected. |

## Where AI is used, and where it is barred

- **Used:** the mission generator writes mission text; the coach gives one hint at a time. Both run on the server, so the API key never reaches the browser.
- **Barred:** AI never writes engine code, never picks a mission's score target (the real engine computes it), and the coach never gives the solution (a leak guard cuts it off).
- **Fallbacks:** no key, a timeout or a bad reply falls back to a seed mission or a stored hint.
- **Privacy:** no student accounts. Names, phone numbers, emails and addresses are removed from text before it is saved or sent to Claude. The shelter mission uses made-up people. Generated missions need an adult's approval. See section 17 of the plan.

## Who owns what (explain-back)

Each person should be able to walk a judge through their own part, and explain someone else's part for two minutes before the demo.

| Part | Folder | Owner |
|---|---|---|
| Engine and shared types | `web/src/engine/`, `shared/` | TODO: name |
| Data pipeline | `data/` | TODO: name |
| Server, generator, coach | `server/` | TODO: name |
| 3D map | `web/src/map/` | TODO: name |
| Python editor and worker | `web/src/code/`, `web/src/py/` | TODO: name |
| Screens, landing page, theme | `web/src/pages/`, `web/src/landing/`, `web/src/theme.ts` | TODO: name |
| Challenges | `web/src/challenges/` | TODO: name |
| City problems workspace | `web/src/workspace/`, `server/src/cityProblems.ts` | TODO: name |

The git history shows two committers so far: Pranay Joshi and Margulan Baizhakyp.

## Open questions (ask an organizer)

- Is a Devpost page, a written summary or a demo video required besides the repo and the demo?
- What is the deadline, to the minute?
- Which branch do judges open? This repo's default is `main`. Work is on `build` until it is merged.
- How many people are on the team, and what is the projector resolution? (The UI is laid out for 1280x720.)

## Before the deadline

- [ ] Merge `build` into `main` and push `main` (judges will likely open the default branch).
- [ ] Fill in the owner names above.
- [ ] Record the backup video.
- [ ] Keep `docs/ai-log.md` current for anything added after this pass.
- [ ] Rehearse the demo once on the projector or TV.
