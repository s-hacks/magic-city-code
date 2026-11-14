// Messages between the page and the Python worker. Owned by python-sandbox; others import it.
import type { Action, SiteInfo, Neighborhood, Store } from "@mcc/shared";

export type ToWorker = {
  type: "run";
  runId: number;
  code: string;
  sites: SiteInfo[];
  stores: Store[];
  neighborhoods: (Neighborhood & { households: number })[];
};

export type FromWorker =
  | { type: "loading"; message: string; progress?: number } // Pyodide start-up stage; progress 0..1 (additive)
  | { type: "ready" }
  | { type: "load_error"; message: string } // Pyodide could not start, e.g. files missing (additive)
  | { type: "stdout"; runId: number; text: string }
  | { type: "done"; runId: number; actions: Action[] }
  | { type: "error"; runId: number; friendly: string; line?: number; raw: string };
