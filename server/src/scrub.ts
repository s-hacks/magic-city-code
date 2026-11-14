// Removes personal details from a resident's words before we save them or send them to Claude:
// emails, phone numbers, street addresses, and names after "my name is", "I'm" or "this is".

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// 205-555-1234, (205) 555 1234, 205.555.1234, +1 205 555 1234, 2055551234
const PHONE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

// A house number, up to four words, then a street word. Full street words must be
// capitalized ("Main Street") so phrases like "2 kids drive" are left alone; short
// forms ("st", "Ave") match in any case. An optional direction and unit can follow.
const FULL_SUFFIX =
  "Street|Avenue|Road|Boulevard|Drive|Lane|Court|Place|Way|Parkway|Circle|Terrace|Highway|Trail|Alley";
const SHORT_SUFFIX = "[Ss][Tt]|[Aa][Vv][Ee]|[Rr][Dd]|[Bb][Ll][Vv][Dd]|[Dd][Rr]|[Ll][Nn]|[Cc][Tt]|[Pp][Ll]|[Pp][Kk][Ww][Yy]|[Hh][Ww][Yy]|[Cc][Ii][Rr]";
const ADDRESS = new RegExp(
  String.raw`\b\d{1,6}(?:\s+[A-Za-z0-9'.-]+){1,4}?\s+(?:${FULL_SUFFIX}|${SHORT_SUFFIX})\b\.?` +
    String.raw`(?:\s+(?:N|S|E|W|NE|NW|SE|SW)\b\.?)?` +
    String.raw`(?:,?\s+(?:Apt|Apartment|Unit|Suite|#)\.?\s*\w+)?`,
  "g",
);

// "my name is Mary Smith", "I'm Mary", "this is Mr. Jones". The trigger may be any case;
// the name itself must start with a capital letter so "I'm worried" is left alone.
const NAME_TRIGGER = String.raw`\b(?:[Mm]y name is|[Mm]y name's|[Nn]ame's|[Ii]['’]m|[Ii] am|[Tt]his is)`;
const NAME_WORD = String.raw`(?:(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+)?[A-Z][a-zA-Z'’-]+`;
const NAME = new RegExp(String.raw`${NAME_TRIGGER}\s+(${NAME_WORD}(?:\s+[A-Z][a-zA-Z'’-]+)?)`, "g");
const TITLE_NAME = /\b(?:Mr|Mrs|Ms|Miss)\.?\s+[A-Z][a-zA-Z'’-]+/g;

/** Words that look like names after "this is" but are fine to keep (places, the city). */
const DEFAULT_KEEP = [
  "Birmingham",
  "Alabama",
  "Magic",
  "West",
  "East",
  "North",
  "South",
  "Southside",
  "Downtown",
  "Ensley",
  "Woodlawn",
  "Avondale",
  "Titusville",
  "Norwood",
  "Kingston",
  "Pratt",
  "Wylam",
  "Fairfield",
  "Bessemer",
  "Homewood",
  "Not",
  "Just",
  "So",
  "Really",
  "Very",
  "The",
  "A",
  "An",
  "Our",
  "My",
];

export interface ScrubOptions {
  /** Extra words (like neighborhood names) never treated as a person's name. */
  keepWords?: string[];
}

/** Scrub resident or student words: personal details removed, extra spaces squeezed out. */
export function scrub(text: string, options: ScrubOptions = {}): string {
  return removeDetails(text, options).replace(/[ \t]{2,}/g, " ").trim();
}

/** Scrub Python code: same removals, but spacing is kept exactly, because indentation is meaning. */
export function scrubCode(code: string, options: ScrubOptions = {}): string {
  return removeDetails(code, options);
}

function removeDetails(text: string, options: ScrubOptions): string {
  const keep = new Set([...DEFAULT_KEEP, ...(options.keepWords ?? []).flatMap((w) => w.split(/\s+/))]);
  let out = text;
  out = out.replace(EMAIL, "[email]");
  out = out.replace(PHONE, "[phone]");
  out = out.replace(ADDRESS, "[address]");
  out = out.replace(NAME, (match: string, name: string) => {
    const first = name.replace(/^(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+/, "").split(/\s+/)[0] ?? "";
    if (keep.has(first)) return match;
    return match.slice(0, match.length - name.length) + "[name]";
  });
  out = out.replace(TITLE_NAME, "[name]");
  return out;
}
