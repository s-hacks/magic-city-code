// The live map preview beside the editor. It always shows the project's data files that have
// latitude/longitude (one color per file), and on top, whatever the program drew with
// `mapview` on its last run: points, highlighted answers (numbered, glowing) and routes.
// Hover a spot to see its row. The map refits when the set of data files changes, not on
// every run, so the view stays put while the student edits.
import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { Project } from "@mcc/shared";
import { applyTheme, makeStyle } from "../map/style";
import { BIRMINGHAM } from "../data/mock";
import type { ThemeName } from "../theme";
import { dataSets, type MapItem, type MapLayer } from "./mapData";

export type MapState = "idle" | "running" | "ok" | "error" | "stale";

interface Props {
  project: Project;
  layers: MapLayer[];
  theme: ThemeName;
  state: MapState;
  live: boolean | null; // null = no live toggle (read-only review)
  onLive?: (on: boolean) => void;
  onClose: () => void;
}

const FILE_COLORS = ["green", "violet", "blue", "pink", "orange", "cyan"];
const MAX_MARKERS = 60;
const SRC = ["mv-data", "mv-route", "mv-points", "mv-hl"] as const;
const emptyFC: FeatureCollection = { type: "FeatureCollection", features: [] };

/** A named color ("gold", "cyan") from the app's CSS variables; anything else as given. */
function resolve(color: string | null | undefined, fallback: string): string {
  const name = (color || fallback).trim();
  const alias: Record<string, string> = { gold: "accent", yellow: "accent", purple: "violet", teal: "cyan" };
  const v = /^[a-z]+$/i.test(name) ? getComputedStyle(document.documentElement).getPropertyValue(`--${alias[name] ?? name}`).trim() : "";
  return v || (CSS.supports("color", name) ? name : getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#FFC53D");
}

const pt = (it: MapItem, extra: Record<string, unknown>): Feature<Point> => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [it.lon, it.lat] },
  properties: { ...extra, row: JSON.stringify(it.props) },
});

export default function MapPreview({ project, layers, theme, state, live, onLive, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const fitKey = useRef("");
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const sets = useMemo(() => dataSets(project), [project]);
  const drawn = layers.filter((l) => l.kind !== "note");
  const notes = layers.filter((l) => l.kind === "note" && l.text).map((l) => l.text!);

  // --- the map itself ---------------------------------------------------------------------------
  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current!,
      style: makeStyle(theme),
      center: BIRMINGHAM,
      zoom: 12,
      pitch: 30,
      bearing: -10,
      attributionControl: { compact: true },
    });
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.current = m;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "mv-popup" });

    m.on("load", () => {
      for (const id of SRC) m.addSource(id, { type: "geojson", data: emptyFC });
      m.addLayer({ id: "mv-data", type: "circle", source: "mv-data", paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 15, 6, 18, 10],
        "circle-opacity": 0.6,
        "circle-stroke-width": 1,
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-opacity": 0.9,
      } });
      m.addLayer({ id: "mv-route-glow", type: "line", source: "mv-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 10, "line-opacity": 0.22, "line-blur": 4 } });
      m.addLayer({ id: "mv-route", type: "line", source: "mv-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": ["get", "color"], "line-width": 3.5 } });
      m.addLayer({ id: "mv-points", type: "circle", source: "mv-points", paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 15, 7, 18, 11],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0.6,
      } });
      m.addLayer({ id: "mv-hl-glow", type: "circle", source: "mv-hl", paint: { "circle-color": ["get", "color"], "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 14, 16, 30], "circle-opacity": 0.35, "circle-blur": 1 } });
      m.addLayer({ id: "mv-hl", type: "circle", source: "mv-hl", paint: {
        "circle-color": ["get", "color"],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 16, 11],
        "circle-stroke-width": 2.5,
        "circle-stroke-color": "#ffffff",
      } });
      setReady(true);
    });

    // Hover a spot: show its row (built as text nodes, never HTML from the data).
    const show = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f) return;
      m.getCanvas().style.cursor = "pointer";
      const row = JSON.parse(String(f.properties?.row ?? "{}")) as Record<string, unknown>;
      const el = document.createElement("div");
      const title = document.createElement("div");
      title.className = "mv-pop-title";
      title.textContent = String(f.properties?.title ?? "");
      el.appendChild(title);
      const dl = document.createElement("dl");
      for (const [k, v] of Object.entries(row).slice(0, 10)) {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = String(v);
        dl.append(dt, dd);
      }
      el.appendChild(dl);
      popup.setLngLat((f.geometry as Point).coordinates as [number, number]).setDOMContent(el).addTo(m);
    };
    const hide = () => { m.getCanvas().style.cursor = ""; popup.remove(); };
    for (const id of ["mv-data", "mv-points", "mv-hl"]) {
      m.on("mousemove", id, show);
      m.on("mouseleave", id, hide);
    }

    const ro = new ResizeObserver(() => m.resize());
    ro.observe(box.current!);
    return () => { ro.disconnect(); markers.current.forEach((k) => k.remove()); popup.remove(); m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (ready && map.current) applyTheme(map.current, theme); }, [theme, ready]);

  // --- the project's data files -----------------------------------------------------------------
  const fileColor = (i: number) => resolve(FILE_COLORS[i % FILE_COLORS.length], "green");
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const features = sets.flatMap((d, i) => (hidden.has(d.file) ? [] : d.items.map((it) => pt(it, { color: fileColor(i), title: d.file }))));
    (m.getSource("mv-data") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, hidden, ready, theme]);

  // --- what the program drew --------------------------------------------------------------------
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const pts: Feature[] = [];
    const hl: Feature[] = [];
    const routes: Feature<LineString>[] = [];
    markers.current.forEach((k) => k.remove());
    markers.current = [];
    const mark = (it: MapItem, n: number, color: string) => {
      if (markers.current.length >= MAX_MARKERS) return;
      const el = document.createElement("div");
      el.className = "mv-rank";
      el.style.setProperty("--c", color);
      // The marker shows the order (1 = best / first stop); the label is in the tooltip and popup.
      el.textContent = String(n);
      if (it.props.label != null) el.title = String(it.props.label);
      markers.current.push(new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -12] }).setLngLat([it.lon, it.lat]).addTo(m));
    };
    for (const l of drawn) {
      if (l.kind === "points") {
        const c = resolve(l.color, "cyan");
        l.items.forEach((it) => pts.push(pt(it, { color: c, title: l.name })));
      } else if (l.kind === "highlight") {
        const c = resolve(l.color, "gold");
        l.items.forEach((it, i) => { hl.push(pt(it, { color: c, title: `${l.name} #${i + 1}` })); mark(it, i + 1, c); });
      } else if (l.kind === "route" && l.items.length) {
        const c = resolve(l.color, "gold");
        routes.push({ type: "Feature", geometry: { type: "LineString", coordinates: l.items.map((it) => [it.lon, it.lat]) }, properties: { color: c } });
        if (l.items.length <= 30) l.items.forEach((it, i) => { pts.push(pt(it, { color: c, title: `${l.name} stop ${i + 1}` })); mark(it, i + 1, c); });
      }
    }
    (m.getSource("mv-points") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: pts });
    (m.getSource("mv-hl") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: hl });
    (m.getSource("mv-route") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: routes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, ready, theme]);

  // --- framing: fit when the data files (or, with none, the drawing) first appear ---------------
  const allItems = useMemo(() => [...sets.flatMap((d) => d.items), ...drawn.flatMap((l) => l.items)], [sets, drawn]);
  const fit = (animate = true) => {
    const m = map.current;
    if (!m || !allItems.length) return;
    const b = new maplibregl.LngLatBounds();
    allItems.forEach((it) => b.extend([it.lon, it.lat]));
    m.fitBounds(b, { padding: { top: 70, bottom: 70, left: 50, right: 50 }, maxZoom: 15.5, duration: animate ? 900 : 0, pitch: 30 });
  };
  useEffect(() => {
    if (!ready) return;
    const key = sets.length ? sets.map((d) => `${d.file}:${d.items.length}`).join("|") : drawn.length ? "drawn" : "";
    if (key && key !== fitKey.current) { fitKey.current = key; fit(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sets, drawn.length]);

  const empty = ready && !sets.length && !drawn.length;
  const count = (l: MapLayer) => {
    if (l.kind !== "route") return `${l.items.length} ${l.items.length === 1 ? "spot" : "spots"}`;
    // A round trip ends where it started: count that place once.
    const [a, z] = [l.items[0], l.items[l.items.length - 1]];
    const loop = l.items.length > 2 && a.lat === z.lat && a.lon === z.lon;
    return `${l.items.length - (loop ? 1 : 0)} places${loop ? ", round trip" : ""}`;
  };

  return (
    <section className="card mv">
      <div className="mv-head">
        <span className="eyebrow">Map</span>
        <span className={`mv-state ${state}`}>
          {state === "running" ? <><i className="spin" /> Running…</> : state === "error" ? "Last run had an error" : state === "stale" ? "Changed since the last run" : state === "ok" ? "Up to date" : "Run to draw your answer"}
        </span>
        {live !== null && (
          <label className="mv-live" title="Run main.py a moment after you stop typing, and redraw the map">
            <input type="checkbox" checked={live} onChange={(e) => onLive?.(e.currentTarget.checked)} /> Live
          </label>
        )}
        <button className="ft-tool" onClick={() => fit()} title="Fit the map to the data" aria-label="Fit the map to the data">⤢</button>
        <button className="ft-tool" onClick={onClose} title="Hide the map" aria-label="Hide the map">×</button>
      </div>
      <div className="mv-canvas-wrap">
        <div ref={box} className="mv-canvas" />
        {notes.length > 0 && <div className="mv-notes glass">{notes.slice(-3).map((n, i) => <p key={i}>{n}</p>)}</div>}
        {(sets.length > 0 || drawn.length > 0) && (
          <div className="mv-legend glass">
            {sets.map((d, i) => (
              <button key={d.file} className="mv-key" aria-pressed={!hidden.has(d.file)} title={hidden.has(d.file) ? "Show" : "Hide"}
                onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(d.file)) n.delete(d.file); else n.add(d.file); return n; })}>
                <i style={{ background: fileColor(i) }} /> {d.file.split("/").pop()} <small>{d.items.length}</small>
              </button>
            ))}
            {drawn.map((l, i) => (
              <span key={`${l.name}${i}`} className="mv-key drawn">
                <i className={l.kind} style={{ background: resolve(l.color, l.kind === "points" ? "cyan" : "gold") }} /> {l.name === l.kind ? (l.kind === "highlight" ? "your answer" : l.kind === "route" ? "your route" : "your points") : l.name} <small>{count(l)}</small>
              </span>
            ))}
          </div>
        )}
        {empty && (
          <div className="mv-empty glass">
            <strong>Nothing on the map yet</strong>
            <p>Data files with <code>lat</code> and <code>lon</code> columns show up here by themselves. To draw your answer, add to <code>main.py</code>:</p>
            <pre>{`import mapview\nmapview.highlight(rows, label="name")`}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
