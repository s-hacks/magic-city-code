import type { ReactNode } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import type { TestRun } from '../py/runner';

// A challenge = description + starter code + data + tests + checker + a map visualizer.
// Add a new one by creating src/challenges/<name>/ and registering it in src/challenges/index.ts.

export interface BaseTest { id: string; name: string; visible: boolean }

export interface Verdict {
  ok: boolean;
  kind: 'pass' | 'crash' | 'timeout' | 'type' | 'empty' | 'endpoints' | 'gap' | 'closed' | 'longer' | 'wrong';
  title: string;
  detail: string;
  line?: number; // editor line to underline
}

export interface RunOptions { flood: boolean }

export interface Viz<T extends BaseTest> {
  /** Draw a test: start/goal, then (with a run) prepare the replay. Returns the number of replay steps. */
  show(test: T, run: TestRun | null, verdict: Verdict | null, opts: RunOptions): number;
  /** Jump the replay to step k (0..length). Returns the editor line for that step, or 0. */
  seek(k: number): number;
  /** Called when the replay reaches the end: draw the route / failure marks. */
  finish(): void;
  ghost(on: boolean): void;
  destroy(): void;
}

/** Optional page wording, so the shared challenge page fits challenges that are not about walking routes. */
export interface ChallengeUi {
  /** Label of the map toggle (sets RunOptions.flood). null hides it. Default: "Flood mode". */
  toggle?: string | null;
  /** Map legend rows: [swatch class, label]. */
  legend?: [string, string][];
  /** Shown before the first run. */
  hint?: string;
  /** Shown when every test passes. */
  accepted?: string;
  /** "Compare with …" button after two failed submits. null hides it. Default: "best route". */
  ghostLabel?: string | null;
  /** Offered when every test passes. */
  next?: { id: string; label: string };
}

export interface Challenge<D, T extends BaseTest> {
  id: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  neighborhood: string;
  tags: string[];
  starterCode: string;
  solution: string;
  harness: string;
  /** Loads data; `raw` is handed to the Python harness as DATA_JSON. */
  load(): Promise<{ data: D; raw: string }>;
  tests(data: D): T[];
  payload(tests: T[], data: D, opts: RunOptions): object;
  check(test: T, run: TestRun, data: D, opts: RunOptions): Verdict;
  Description: (p: { data: D }) => ReactNode;
  createViz(map: MLMap, data: D): Viz<T>;
  ui?: ChallengeUi;
  /** One sentence for cards that list the challenge. */
  summary?: string;
}
