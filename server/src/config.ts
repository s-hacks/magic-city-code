// Settings read from the environment. The .env file sits at the repo root.
// The API key is only ever checked for presence here; it is never logged or returned.
import path from "node:path";
import dotenv from "dotenv";
import { REPO_ROOT } from "./paths";

dotenv.config({ path: path.join(REPO_ROOT, ".env") });

export const PORT = Number(process.env.PORT) || 8787;

/** Both AI routes use Claude Opus 5.5 unless the team overrides it. */
export const GENERATOR_MODEL = process.env.GENERATOR_MODEL || "claude-opus-5-5";
export const COACH_MODEL = process.env.COACH_MODEL || "claude-opus-5-5";

/** True when a Claude key is set and AI has not been switched off (AI_DISABLED=1). */
export function aiEnabled(): boolean {
  if (process.env.AI_DISABLED === "1" || process.env.AI_DISABLED === "true") return false;
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
}

/** Save the store to server/data/store.json unless STORE_PERSIST=0. */
export const STORE_PERSIST = process.env.STORE_PERSIST !== "0";
