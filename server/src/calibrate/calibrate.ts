// Makes sure a mission can be won, and sets each level's goal from real numbers.
// For every level: run the starter code and the answer code in real Pyodide (the same city.py
// the browser uses), score the answer's placements with the real engine, and set
//   goal.target = floor(answer coverage x 100) / 100.
// A level fails if either code raises an error, the answer places nothing or breaks a rule,
// the answer doesn't beat the "before" score, or the starter code already wins.
import type { CityData, Mission } from "@mcc/shared";
import { describeSites, neighborhoodsSummary, simulate } from "../../../web/src/engine";
import type { RunPayload } from "../../../web/src/code/core";
import { getSandbox, type PythonSandbox } from "./sandbox";

export interface LevelCalibration {
  number: number;
  baseline: number;
  starter: number;
  solution: number;
  target: number;
}

export type CalibrationResult =
  | { ok: true; mission: Mission; levels: LevelCalibration[]; ms: number }
  | { ok: true; mission: Mission; skipped: string; ms: number }
  | { ok: false; errors: string[]; ms: number };

const MIN_TARGET = 0.05; // the schema's lowest allowed goal

export async function calibrateMission(
  mission: Mission,
  data: CityData | null,
  sandbox: PythonSandbox = getSandbox(),
): Promise<CalibrationResult> {
  const started = Date.now();
  const ms = () => Date.now() - started;
  if (!data) return { ok: true, mission, skipped: "city data not loaded; goal targets left as they were", ms: ms() };

  const payload: RunPayload = {
    sites: describeSites(mission, data),
    stores: data.stores,
    neighborhoods: neighborhoodsSummary(mission, data),
  };

  const errors: string[] = [];
  const levels: LevelCalibration[] = [];
  const newLevels = [];
  try {
    for (let i = 0; i < mission.levels.length; i++) {
      const level = mission.levels[i];
      const tag = `level ${level.number}`;
      const fail = (msg: string) => errors.push(`${tag}: ${msg}`);

      const starterRun = await sandbox.run(level.starterCode, payload);
      if (!starterRun.ok) {
        fail(`starterCode raises a Python error: ${starterRun.friendly}`);
        newLevels.push(level);
        continue;
      }
      const solutionRun = await sandbox.run(level.solution, payload);
      if (!solutionRun.ok) {
        fail(`solution raises a Python error: ${solutionRun.friendly}`);
        newLevels.push(level);
        continue;
      }
      if (solutionRun.actions.length === 0) {
        fail("solution places nothing (it must call city.place_hub)");
        newLevels.push(level);
        continue;
      }

      const sol = simulate(mission, solutionRun.actions, data, i);
      if (!sol.ok) {
        fail(`solution breaks a rule: ${sol.errors.map((e) => e.message).join(" ")}`);
        newLevels.push(level);
        continue;
      }
      const base = sol.metrics.baselineCoverage;
      const cov = sol.metrics.coverage;
      if (cov <= base) {
        fail(`solution does not improve coverage (before ${pct(base)}, after ${pct(cov)}); choose sites or kinds that reach more people`);
        newLevels.push(level);
        continue;
      }

      // Round down to whole percent; use tenths of a percent if that would not beat the "before" score.
      let target = Math.floor(cov * 100) / 100;
      if (target <= base) target = Math.floor(cov * 1000) / 1000;
      if (target <= base || target < MIN_TARGET) {
        fail(`solution reaches only ${pct(cov)} (before ${pct(base)}); too small a change to be a goal`);
        newLevels.push(level);
        continue;
      }

      const starter = simulate(mission, starterRun.actions, data, i);
      const starterCov = starter.ok ? starter.metrics.coverage : base;
      if (starter.ok && starterCov >= target) {
        fail(`starterCode already reaches the goal (${pct(starterCov)} of ${pct(target)}); leave the key step for the student`);
        newLevels.push(level);
        continue;
      }

      levels.push({ number: level.number, baseline: base, starter: starterCov, solution: cov, target });
      newLevels.push({ ...level, goal: { ...level.goal, target } });
    }
  } catch (err) {
    // Python could not start at all: don't block the mission, keep the old targets.
    return { ok: true, mission, skipped: `Python sandbox unavailable (${(err as Error).message})`, ms: ms() };
  }

  if (errors.length) return { ok: false, errors, ms: ms() };
  return { ok: true, mission: { ...mission, levels: newLevels }, levels, ms: ms() };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
