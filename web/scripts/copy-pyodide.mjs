// Copies the Pyodide runtime files from node_modules into public/pyodide/ so the app
// serves them itself (works offline at the venue). Run by "predev" and "prebuild".
// public/pyodide/ is gitignored.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(webDir, "package.json"));
const srcDir = dirname(require.resolve("pyodide/package.json"));
const destDir = join(webDir, "public", "pyodide");

const files = ["pyodide.mjs", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];

mkdirSync(destDir, { recursive: true });
let copied = 0;
for (const f of files) {
  const from = join(srcDir, f);
  const to = join(destDir, f);
  if (!existsSync(from)) {
    console.error(`copy-pyodide: missing ${from}. Did you run pnpm install?`);
    process.exit(1);
  }
  // Skip files that are already up to date.
  if (existsSync(to) && statSync(to).size === statSync(from).size && statSync(to).mtimeMs >= statSync(from).mtimeMs) continue;
  copyFileSync(from, to);
  copied++;
}
console.log(`copy-pyodide: ${copied ? `copied ${copied} file(s)` : "already up to date"} -> public/pyodide/`);
