// Worker-thread entry. Registers tsx so the TypeScript worker (and the web app's
// code/core.ts it reuses) can load, then hands over to it.
import { register } from "tsx/esm/api";

register();
await import("./python-worker-impl.ts");
