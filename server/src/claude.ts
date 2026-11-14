// One shared Claude client, created only when a key is set. The SDK reads ANTHROPIC_API_KEY
// from the environment itself, so the key never passes through our code or our logs.
import Anthropic from "@anthropic-ai/sdk";
import { aiEnabled } from "./config";

let client: Anthropic | null = null;

export function getClaude(): Anthropic | null {
  if (!aiEnabled()) return null;
  // Keep retries and timeouts short: the demo would rather fall back than wait.
  client ??= new Anthropic({ maxRetries: 1, timeout: 90_000 });
  return client;
}

/**
 * Server-side refusal fallback (beta). If Claude declines, the API re-runs the request on a
 * fallback model inside the same call, picked by refusal category.
 */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01" as const;

/** A short, key-free description of an SDK error, safe to log. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? "(no status)"} (${err.constructor.name})`;
  if (err instanceof Error) return err.message.slice(0, 200);
  return "unknown error";
}
