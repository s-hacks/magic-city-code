// Runs the five showcase problems (docs/showcase-examples.md) plus one that should be unsupported
// through the mission generator directly (not over HTTP), and prints what each became.
// Usage: npx tsx scripts/try-generate.ts            (uses Claude if ANTHROPIC_API_KEY is set)
//        npx tsx scripts/try-generate.ts --offline  (keyword fallback only)
import "../src/config";
import { getClaude } from "../src/claude";
import { loadCity } from "../src/city";
import { generateMission } from "../src/generator";
import { Store } from "../src/store";
import { validateMission } from "../src/validate";

const PROBLEMS = [
  "There's no grocery store near West End, and I don't have a car.",
  "My kids can't do their homework online at home.",
  "On cold nights, where can people near me go to get warm?",
  "With no Saturday bus, I can't get to the store on my day off.",
  "The produce truck never comes to our side of the neighborhood.",
  "My water bill is wrong",
];

const offline = process.argv.includes("--offline");
const claude = offline ? null : getClaude();
const store = new Store({ persistPath: null });
const city = loadCity();

console.log(`AI: ${claude ? "on" : "off"} | seed missions: ${store.seedMissions().length} | data: ${city.sites ? "loaded" : "missing"}\n`);

let playable = 0;
for (const text of PROBLEMS) {
  const started = Date.now();
  const out = await generateMission({ text }, { store, claude, city });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  const by = out.usedAI ? "AI" : "fallback";
  console.log(`"${text}"`);
  if (out.response.status === "ok") {
    const m = out.response.mission;
    const check = validateMission(m, city);
    if (check.ok) playable++;
    const maxP = Math.max(...m.levels.map((l) => l.maxPlacements));
    console.log(
      `  -> PLAYABLE (${by}, ${out.attempts} call(s), ${secs}s): "${m.title}" in ${m.area.neighborhood}, ` +
        `${m.thing} at ${m.siteKinds.join("/")}, counts ${m.needColumn}, up to ${maxP}, partner ${m.partner}`,
    );
    if (check.ok && check.warnings.length) console.log(`     warnings: ${check.warnings.join("; ")}`);
    if (!check.ok) console.log(`     FAILED re-check: ${check.errors.join("; ")}`);
  } else {
    console.log(`  -> UNSUPPORTED (${by}, ${out.attempts} call(s), ${secs}s): ${out.response.reason}`);
  }
  if (out.notes.length) console.log(`     notes: ${out.notes.join(" | ")}`);
}
console.log(`\n${playable} of ${PROBLEMS.length} became playable missions.`);
