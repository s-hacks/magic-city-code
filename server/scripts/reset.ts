// Puts the demo back to its seed state without the server: deletes server/data/store.json.
// If a server is running on this computer, it is asked to reset its memory too.
// Usage: pnpm --filter @mcc/server reset   (or: npx tsx scripts/reset.ts)
import fs from "node:fs";
import { PORT } from "../src/config";
import { STORE_FILE } from "../src/paths";

const existed = fs.existsSync(STORE_FILE);
fs.rmSync(STORE_FILE, { force: true });
console.log(existed ? `Deleted ${STORE_FILE}` : "No saved store file; already at the seed state on disk.");

try {
  const res = await fetch(`http://127.0.0.1:${PORT}/api/admin/reset`, { method: "POST", signal: AbortSignal.timeout(1500) });
  console.log(res.ok ? "The running server was reset too." : `The running server said ${res.status}.`);
} catch {
  console.log("No server running; it will start from the seed files next time.");
}
