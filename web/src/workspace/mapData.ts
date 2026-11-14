// What the map preview draws: the project's own data (any CSV or JSON with latitude and
// longitude) plus whatever the program drew with the `mapview` module on its last run.
import type { Project } from "@mcc/shared";

export type MapProps = Record<string, string | number | boolean | null>;
export interface MapItem { lat: number; lon: number; props: MapProps }
/** One thing a run drew with mapview (see runner.py). */
export interface MapLayer {
  kind: "points" | "highlight" | "route" | "note";
  name: string;
  color: string | null;
  items: MapItem[];
  text?: string;
}
/** Spots read straight from one data file. */
export interface DataSet { file: string; items: MapItem[] }

const MAX_PER_FILE = 5000;
const LAT = /^(lat|latitude)$/i;
const LON = /^(lon|lng|long|longitude)$/i;

/** A small CSV reader: commas, quoted cells, "" inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
const onEarth = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

function fromRecords(records: Record<string, unknown>[]): MapItem[] {
  if (!records.length) return [];
  const keys = Object.keys(records[0]);
  const latK = keys.find((k) => LAT.test(k));
  const lonK = keys.find((k) => LON.test(k));
  if (!latK || !lonK) return [];
  const out: MapItem[] = [];
  for (const r of records) {
    const lat = num(r[latK]);
    const lon = num(r[lonK]);
    if (!onEarth(lat, lon)) continue;
    const props: MapProps = {};
    for (const [k, v] of Object.entries(r).slice(0, 12)) props[k] = v === null || ["string", "number", "boolean"].includes(typeof v) ? (v as MapProps[string]) : JSON.stringify(v);
    out.push({ lat, lon, props });
    if (out.length >= MAX_PER_FILE) break;
  }
  return out;
}

/** Spots from one file, or [] when it has no latitude/longitude. */
export function itemsFromFile(path: string, content: string): MapItem[] {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  try {
    if (ext === "csv") {
      const [head, ...rows] = parseCsv(content);
      if (!head) return [];
      return fromRecords(rows.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ""]))));
    }
    if (ext === "json" || ext === "geojson") {
      const data = JSON.parse(content) as unknown;
      if (data && typeof data === "object" && (data as { type?: string }).type === "FeatureCollection") {
        const feats = (data as { features: { geometry?: { type: string; coordinates: number[] }; properties?: Record<string, unknown> }[] }).features ?? [];
        return fromRecords(feats.filter((f) => f.geometry?.type === "Point").map((f) => ({ ...(f.properties ?? {}), lat: f.geometry!.coordinates[1], lon: f.geometry!.coordinates[0] })));
      }
      const list = Array.isArray(data) ? data : [data];
      return fromRecords(list.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x)));
    }
  } catch {
    /* half-typed JSON or a strange file: just don't draw it */
  }
  return [];
}

/** Every data file in the project that has spots on the map. */
export function dataSets(project: Project): DataSet[] {
  return project.files
    .filter((f) => /\.(csv|json|geojson)$/i.test(f.path) && !/(^|\/)(tests?)\//.test(f.path))
    .map((f) => ({ file: f.path, items: itemsFromFile(f.path, f.content) }))
    .filter((d) => d.items.length > 0);
}
