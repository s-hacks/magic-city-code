// Starts the Magic City Code server. Settings come from the repo-root .env (see config.ts).
import { aiEnabled, PORT, STORE_PERSIST } from "./config";
import { createApp } from "./app";
import { getSandbox } from "./calibrate/sandbox";
import { STORE_FILE } from "./paths";
import { Store } from "./store";

const store = new Store({ persistPath: STORE_PERSIST ? STORE_FILE : null });
const app = createApp(store);

// Load Python in the background now so the first generated mission doesn't wait for it.
const sandbox = getSandbox();
sandbox
  .warm()
  .then(() => console.log(`[calibrate] Python ready in ${sandbox.lastLoadMs} ms`))
  .catch((err) => console.warn(`[calibrate] Python failed to load; missions will skip calibration: ${(err as Error).message}`));

app.listen(PORT, () => {
  console.log(
    `Magic City Code server on http://localhost:${PORT} — AI ${aiEnabled() ? "on" : "off (fallbacks only)"}, ` +
      `${store.listMissions().length} mission(s), ${store.listProblems().length} problem card(s)`,
  );
});
