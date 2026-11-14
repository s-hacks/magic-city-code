// Where things live on disk. Every path is worked out from the repo root,
// so the server runs the same no matter which folder you start it from.
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(here, "../..");
export const SERVER_ROOT = path.resolve(here, "..");
export const DATA_DIR = path.join(REPO_ROOT, "web/public/data");
export const MISSIONS_DIR = path.join(DATA_DIR, "missions");
export const PROBLEMS_SEED_FILE = path.join(DATA_DIR, "problems.seed.json");
export const STORE_FILE = path.join(SERVER_ROOT, "data/store.json");
