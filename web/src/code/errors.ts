// Turns Python errors into plain words a student can act on. Pure TypeScript, no Pyodide needed.
//
// The worker sends a PyErrorInfo (type, message, line, and the names Python knew about).
// translateError() returns a sentence that starts with "Line N: ..." and, for typos,
// says "Did you mean `place_hub`?". The editor underlines `line`.

/** What the Python side tells us about a failed run. */
export interface PyErrorInfo {
  type: string; // "NameError", "SyntaxError", "CityError", ...
  message: string; // Python's own message, e.g. "name 'plase_hub' is not defined"
  line?: number | null; // the student's line, 1-based
  offset?: number | null; // SyntaxError column
  text?: string | null; // SyntaxError: the offending source line
  name?: string | null; // NameError / AttributeError: the missing name
  candidates?: string[]; // names that exist (for "did you mean")
  objType?: string; // AttributeError: type of the object ("Site", "list", "module:city")
  traceback?: string;
}

export interface FriendlyError {
  friendly: string; // full sentence including the "Line N: " prefix when we know the line
  line?: number;
}

/** The names that live inside `city`. Typos against these get a `city.` suggestion. */
export const CITY_API = ["sites", "stores", "place_hub", "neighborhoods"];

/** What a Site has. */
export const SITE_ATTRS = [
  "id",
  "name",
  "kind",
  "lat",
  "lon",
  "families_nearby",
  "families_without_car",
  "minutes_to_store",
];

const BASIC_BUILTINS = [
  "print", "len", "range", "sorted", "sum", "min", "max", "list", "str", "int", "float",
  "abs", "round", "enumerate", "zip", "reversed", "any", "all", "dict", "set", "tuple",
  "True", "False", "None", "city",
];

// ---------------------------------------------------------------------------
// "Did you mean" helpers
// ---------------------------------------------------------------------------

/** Edit distance where swapping two neighbouring letters counts as one change. */
export function editDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  const d: number[][] = Array.from({ length: al + 1 }, () => new Array<number>(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[al][bl];
}

/** Closest candidate to `word`, or null if nothing is close enough. Ignores upper/lower case. */
export function suggest(word: string, candidates: string[]): string | null {
  const w = word.toLowerCase();
  const maxDist = w.length <= 2 ? 0 : w.length <= 5 ? 1 : 2;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c === word) continue;
    const dist = editDistance(w, c.toLowerCase());
    if (dist <= maxDist && dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The translator
// ---------------------------------------------------------------------------

export function translateError(info: PyErrorInfo): FriendlyError {
  const line = typeof info.line === "number" && info.line > 0 ? info.line : undefined;
  const body = explain(info);
  return { friendly: line ? `Line ${line}: ${body}` : body, line };
}

function explain(info: PyErrorInfo): string {
  const msg = info.message ?? "";
  switch (info.type) {
    case "CityError":
      return msg; // already written for students
    case "IndentationError":
    case "TabError":
    case "SyntaxError":
      return explainSyntax(info);
    case "NameError":
      return explainName(info);
    case "UnboundLocalError":
      return explainUnbound(msg);
    case "AttributeError":
      return explainAttribute(info);
    case "TypeError":
      return explainType(msg);
    case "IndexError":
      return "You asked for a spot in the list that doesn't exist. Lists start counting at 0, so a list of 5 things has spots 0 to 4.";
    case "KeyError":
      return `There is no entry called ${msg || "that"}. Check the spelling of the key.`;
    case "ZeroDivisionError":
      return "You divided by zero, and nothing can do that. Check the number after the `/`.";
    case "ValueError":
      return `Python got a value it can't use here (${msg}).`;
    case "ModuleNotFoundError":
    case "ImportError": {
      const m = /No module named '([^']+)'/.exec(msg);
      return m
        ? `Python can't find a module called \`${m[1]}\`. In this app you only need \`city\`, and it is already loaded for you.`
        : `Python couldn't load that module (${msg}).`;
    }
    case "RecursionError":
      return "A function keeps calling itself and never stops. Make sure it has a way to finish.";
    case "EOFError":
      return "`input()` doesn't work here. Write the answer straight into your code instead.";
    case "MemoryError":
      return "Your code is making a huge list. Is a loop adding to it forever?";
    case "StopIteration":
      return "Python ran out of things to look at.";
    default:
      return `Python hit a problem: ${info.type}${msg ? ": " + msg : ""}.`;
  }
}

function explainSyntax(info: PyErrorInfo): string {
  const msg = info.message ?? "";
  const snippet = info.text && info.text.trim() ? ` The line reads: \`${info.text.trim()}\`` : "";

  if (/expected an indented block/.test(msg)) {
    return "Python expected this line to be indented (pushed to the right with spaces), because the line before it ends with a colon `:`. Add 4 spaces at the start.";
  }
  if (/unexpected indent/.test(msg)) {
    return "This line is pushed to the right, but the line above doesn't need it. Take the extra spaces off the start.";
  }
  if (/unindent does not match/.test(msg)) {
    return "The spaces at the start of this line don't line up with any line above. Make them match the block you are in.";
  }
  if (/inconsistent use of tabs/.test(msg)) {
    return "This line mixes tabs and spaces at the start. Use spaces only.";
  }
  const unclosed = /'(.)' was never closed/.exec(msg);
  if (unclosed) {
    const close: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
    const open = unclosed[1];
    return `A \`${open}\` was opened here but never closed. Add a matching \`${close[open] ?? open}\`.`;
  }
  const unmatched = /unmatched '(.)'/.exec(msg);
  if (unmatched) {
    return `There is a \`${unmatched[1]}\` with nothing to match it. Remove it, or add the opening bracket.`;
  }
  if (/unterminated string literal|unterminated triple-quoted/.test(msg)) {
    return "A quote mark was opened but never closed. Put a matching quote at the end of the text.";
  }
  if (/expected ':'/.test(msg)) {
    return "Python expected a colon `:` at the end of this line.";
  }
  if (/Perhaps you forgot a comma/.test(msg)) {
    return `Python got confused here. Did you forget a comma \`,\` between two things?${snippet}`;
  }
  if (/Missing parentheses in call to 'print'/.test(msg)) {
    return "`print` needs parentheses. Write it like `print(\"hello\")`.";
  }
  if (/Maybe you meant '==' or ':='/.test(msg) || /cannot assign to/.test(msg)) {
    return `A single \`=\` stores a value. To ask "are these equal?", use \`==\`.${snippet}`;
  }
  if (/invalid syntax/.test(msg) || msg === "") {
    return `Python can't understand this line. Look for a missing colon, bracket, or quote.${snippet}`;
  }
  return `Python can't read this line (${msg}).${snippet}`;
}

function explainName(info: PyErrorInfo): string {
  const name = info.name ?? /name '([^']+)' is not defined/.exec(info.message ?? "")?.[1] ?? "that word";

  // `place_hub(site)` without `city.` in front.
  if (CITY_API.includes(name)) {
    return `Python doesn't know \`${name}\` on its own. It lives inside \`city\`, so write \`city.${name}\`.`;
  }

  const known = info.candidates && info.candidates.length ? info.candidates : BASIC_BUILTINS;
  // Compare against the student's own names and builtins first, then city functions
  // (so `plase_hub` -> `city.place_hub`). On a tie the student's own name wins.
  const plain = suggest(name, known);
  const viaCity = suggest(name, CITY_API);
  let pick: string | null = plain;
  if (viaCity) {
    const cityDist = editDistance(name.toLowerCase(), viaCity.toLowerCase());
    const plainDist = plain ? editDistance(name.toLowerCase(), plain.toLowerCase()) : Infinity;
    if (cityDist < plainDist) pick = `city.${viaCity}`;
  }

  if (pick) {
    const caseNote = pick.toLowerCase() === name.toLowerCase() ? " Python cares about capital letters." : "";
    return `Python doesn't know the word \`${name}\`. Did you mean \`${pick}\`?${caseNote}`;
  }
  return `Python doesn't know the word \`${name}\`. Did you make it with \`${name} = ...\` before using it, or is it a typo?`;
}

function explainUnbound(msg: string): string {
  const m = /variable '([^']+)'/.exec(msg);
  const name = m ? m[1] : "a variable";
  return `\`${name}\` is used before it has a value. Give it a value earlier in the same spot.`;
}

function explainAttribute(info: PyErrorInfo): string {
  const msg = info.message ?? "";
  const m = /^(?:module '([^']+)'|'([^']+)' object) has no attribute '([^']+)'/.exec(msg);
  const attr = info.name ?? m?.[3] ?? "that";
  const objType = info.objType ?? (m?.[1] ? `module:${m[1]}` : m?.[2] ?? "");

  if (objType === "module:city") {
    const pick = suggest(attr, CITY_API);
    if (pick) return `The \`city\` toolbox has no \`${attr}\`. Did you mean \`city.${pick}\`?`;
    return `The \`city\` toolbox has no \`${attr}\`. It has: ${CITY_API.map((n) => "`city." + n + "`").join(", ")}.`;
  }
  if (objType === "Site") {
    const pool = info.candidates && info.candidates.length ? info.candidates : SITE_ATTRS;
    const pick = suggest(attr, pool);
    if (pick) return `A place has no \`${attr}\`. Did you mean \`${pick}\`?`;
    return `A place has no \`${attr}\`. It has: ${SITE_ATTRS.join(", ")}.`;
  }
  if (objType === "NoneType") {
    return `Something here is \`None\` (nothing), so it has no \`.${attr}\`. Check that the earlier line gave it a value.`;
  }
  if (objType === "list" && (SITE_ATTRS.includes(attr) || CITY_API.includes(attr))) {
    return `A list holds many things, so it has no \`.${attr}\`. Pick one with \`[0]\`, or loop with \`for place in places:\` and use \`place.${attr}\`.`;
  }
  const pool = info.candidates ?? [];
  const pick = pool.length ? suggest(attr, pool) : null;
  const what = objType ? `A \`${objType}\`` : "This";
  return pick
    ? `${what} has no \`.${attr}\`. Did you mean \`.${pick}\`?`
    : `${what} has no \`.${attr}\`. Check the spelling.`;
}

function explainType(msg: string): string {
  let m = /(\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given/.exec(msg);
  if (m) {
    const [, fn, want, got] = m;
    return `\`${fn}\` wants ${want} thing${want === "1" ? "" : "s"} inside the parentheses, but you gave ${got}.`;
  }
  m = /(\w+)\(\) takes no arguments/.exec(msg);
  if (m) return `\`${m[1]}\` doesn't take anything inside the parentheses. Leave them empty.`;
  m = /(\w+)\(\) missing (\d+) required positional arguments?(?:: (.*))?/.exec(msg);
  if (m) {
    const needed = m[3] ? ` (${m[3].replace(/'/g, "")})` : "";
    return `\`${m[1]}\` needs something inside the parentheses${needed}. For example \`city.place_hub(site)\`.`;
  }
  m = /(\w+)\(\) got an unexpected keyword argument '([^']+)'/.exec(msg);
  if (m) return `\`${m[1]}\` doesn't have an option called \`${m[2]}\`. Check the spelling.`;
  m = /'([^']+)' object is not iterable/.exec(msg);
  if (m) return `You can't loop over a \`${m[1]}\`. A \`for\` loop needs a list of things, like \`city.sites()\`.`;
  m = /'([^']+)' object is not subscriptable/.exec(msg);
  if (m) {
    return m[1] === "NoneType"
      ? "Something here is `None` (nothing), so you can't pick items out of it with `[ ]`. Check the line that should have given it a value."
      : `Square brackets \`[ ]\` don't work on a \`${m[1]}\`. They are for lists and text.`;
  }
  m = /'([^']+)' object is not callable/.exec(msg);
  if (m) return `You put \`( )\` after a \`${m[1]}\`, but only functions can be called. Did you use a function's name for your own variable?`;
  m = /'([^']+)' not supported between instances of '([^']+)' and '([^']+)'/.exec(msg);
  if (m) return `Python can't compare a \`${m[2]}\` with a \`${m[3]}\` using \`${m[1]}\`. Are you mixing numbers with text or None?`;
  m = /unsupported operand type\(s\) for ([^:]+): '([^']+)' and '([^']+)'/.exec(msg);
  if (m) return `Python can't use \`${m[1].trim()}\` on a \`${m[2]}\` and a \`${m[3]}\`. Are you mixing numbers with text?`;
  if (/can only concatenate str/.test(msg) || /must be str, not/.test(msg)) {
    return "You can only join text with text. Turn the number into text first, like `str(5)`.";
  }
  m = /'([^']+)' object cannot be interpreted as an integer/.exec(msg);
  if (m) return `Python needs a whole number here, but got a \`${m[1]}\`.`;
  m = /unhashable type: '([^']+)'/.exec(msg);
  if (m) return `A \`${m[1]}\` can't be used here as a key or set item.`;
  return `Python can't do that with those kinds of things (${msg}).`;
}

// ---------------------------------------------------------------------------
// Fallback: read a plain traceback string
// ---------------------------------------------------------------------------

/** Pull type, message and the student's line out of a printed Python traceback. */
export function parseTraceback(tb: string): PyErrorInfo {
  const lines = tb.split("\n").map((l) => l.replace(/\r$/, ""));
  let line: number | undefined;
  for (const l of lines) {
    const m = /File "<student>", line (\d+)/.exec(l);
    if (m) line = Number(m[1]);
  }
  let type = "Error";
  let message = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (!l.trim() || /^\s/.test(l)) continue;
    const m = /^([A-Za-z_][\w.]*)(?:: (.*))?$/.exec(l);
    if (m) {
      type = m[1].split(".").pop() as string;
      message = m[2] ?? "";
      break;
    }
  }
  return { type, message, line, traceback: tb };
}
