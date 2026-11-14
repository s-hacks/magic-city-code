import type { ReactNode } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import type { TestRun } from '../py/runner';

// A challenge = description + starter code + data + tests + checker + a map visualizer.
// Add a new one by creating src/challenges/<name>/ and registering it in src/challenges/index.ts.

export interface BaseTest { id: string; name: string; visible: boolean }

export interface Verdict {
  ok: boolean;
  kind: 'pass' | 'crash' | 'timeout' | 'type' | 'empty' | 'endpoints' | 'gap' | 'closed' | 'longer';
  title: string;
  detail: string;
  line?: number; // editor line to underline
}

export interface Viz<T extends BaseTest> {
  /** Draw a test: start/goal, then (with a run) prepare the replay. Returns the number of replay steps. */
  show(test: T, run: TestRun | null, verdict: Verdict | null): number;
  /** Jump the replay to step k (0..length). Returns the editor line for that step, or 0. */
  seek(k: number): number;
  /** Called when the replay reaches the end: draw the route / failure marks. */
  finish(): void;
  ghost(on: boolean): void;
  destroy(): void;
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
  payload(tests: T[], data: D): object;
  check(test: T, run: TestRun, data: D): Verdict;
  Description: (p: { data: D }) => ReactNode;
  createViz(map: MLMap, data: D): Viz<T>;
}
