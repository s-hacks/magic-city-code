// MapView: the full-screen 3D night map of Birmingham with deck.gl lights on top.
// It only renders what the engine returns. It never computes coverage and never
// changes mission state.
//
// Props
//   mode            "home" (city overview + problem flares) | "mission" (one neighborhood)
//   data            CityData from loadCityData(), or null while loading
//   mission         the open Mission (its bbox, siteKinds, walkMinutes are used)
//   result          the engine Result to show (the student's latest run)
//   baselineResult  the engine Result with zero actions (the city today)
//   showBaseline    true while Compare is held: show the city today
//   runToken        bump this in the same render that sets a new `result` to play the
//                   Run animation. A `result` change without a new token is shown at once.
//   sites           SiteInfo[] from describeSites(), for hover numbers ("412 families nearby")
//   flares          home-mode problem flares; a new id launches a new flare
//   onFlareClick    (flare) => void
//   onFlareHover    (flare | null) => void   (show the problem card)
//   onSiteHover     (site | null) => void
//   onSiteClick     (site) => void            (insert the site id into the code)
//   onRunStep       ({ order, line } | null) => void   called as each beam drops; null clears
//   onRunComplete   () => void   called ~0.9 s after residents flip (meter can fill then).
//                   Also called at once when a Run has an error and nothing was placed.
//   onRunCancel     () => void   a running animation was dropped because `result` (without a
//                   new runToken) or `mission` changed; onRunComplete will NOT fire for it.
//   dayMode         brighter map for washed-out projectors
//   cameraPadding   pixels kept clear for floating panels when framing a mission
//   hidden          layer groups switched off by the legend chips (see layerGroups.ts)
//
// Ref handle (optional): { flyIn(), flyToMission(), getMap() }.
//
// Run sequence (ui-plan.md section 4): at 0 s the camera pushes in; at 0.2 s and
// then every 0.3 s a beam drops for the next hub (in `order`) and onRunStep fires;
// after the last beam lands, residents switch to the new result's colors and the
// served ones drift toward their hub; if the goal is met a gold wave sweeps out.
// A new `result` without a new runToken, or a new mission, cancels a running
// sequence and shows the new result at once.
//
// Hub labels: each beam shows "2 · Name". When labels would overlap on screen, the
// later hub shows only its number; hovering a beam shows the full name.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import maplibregl, { type Map as MlMap, type PaddingOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { PickingInfo } from "@deck.gl/core";
import type { Area, CityData, Mission, ResidentDot, Result, Site, SiteInfo, Store } from "@mcc/shared";
import "./map.css";
import { buildMapStyle, isFallbackStyle, MAP_BACKGROUND } from "./mapStyle";
import { palette } from "./theme";
import { KIND_LABEL } from "./sprites";
import { BHAM_CENTER, bboxCenter, bboxRadiusMeters, flyIn, flyToMission, runPushIn, type Bbox } from "./camera";
import type { FrameCtx } from "./layers/common";
import { residentsLayer, type ResidentView } from "./layers/residents";
import { storeLayers } from "./layers/stores";
import { siteLayers } from "./layers/sites";
import { hazeLayer, type HazeView } from "./layers/haze";
import { DROP_MS, hubLayers, layoutHubLabels, type TimedHub } from "./layers/hubs";
import { flareLayers, type Flare, type TimedFlare } from "./layers/flares";
import { waveLayers, WAVE_MS, type Wave } from "./layers/wave";
import type { LayerGroup } from "./layerGroups";

export type { Flare } from "./layers/flares";

export interface RunStep {
  order: number;
  line?: number;
}

export interface MapViewProps {
  mode: "home" | "mission";
  data: CityData | null;
  mission?: Mission | null;
  result?: Result | null;
  baselineResult?: Result | null;
  showBaseline?: boolean;
  runToken?: number;
  sites?: SiteInfo[];
  flares?: Flare[];
  onFlareClick?: (flare: Flare) => void;
  onFlareHover?: (flare: Flare | null) => void;
  onSiteHover?: (site: SiteInfo | Site | null) => void;
  onSiteClick?: (site: SiteInfo | Site) => void;
  onRunStep?: (step: RunStep | null) => void;
  onRunComplete?: () => void;
  onRunCancel?: () => void;
  dayMode?: boolean;
  cameraPadding?: PaddingOptions;
  hidden?: ReadonlySet<LayerGroup>;
}

export interface MapViewHandle {
  flyIn(): void;
  flyToMission(): void;
  getMap(): MlMap | null;
}

const DEFAULT_PADDING: PaddingOptions = { top: 90, bottom: 110, left: 420, right: 540 };

// Run timing (ms from pressing Run).
const FIRST_DROP = 200;
const DROP_GAP = 300;
const FLIP_AFTER_LAND = 150;
const COMPLETE_AFTER_FLIP = 900;
// Retry the real base map this long after falling back to a plain background.
const STYLE_RETRY_MS = 10000;

interface Tooltip {
  x: number;
  y: number;
  kind: string;
  name: string;
  stats?: string[];
  hint?: string;
}

/** Mutable view state read by the animation loop. Never triggers React renders. */
interface ViewState {
  committed: Result | null; // the result whose residents are shown (when not comparing)
  drift: boolean;
  hubs: TimedHub[];
  walkRadius: number;
  wave: Wave | null;
  running: boolean;
  runResult: Result | null; // the result being animated while running
  missionId: string | null;
  lastToken: number | undefined;
  timers: number[];
  flareBorn: Map<string, number>;
  hoveredSite: string | null;
  hoveredFlare: string | null;
  // memo caches
  resView: ResidentView | null;
  resViewSrc: { arr: ResidentDot[] | null; drift: boolean };
  resKeyN: number;
  haze: HazeView | null;
  hazeSrc: { data: CityData | null; bbox: Bbox | null; arr: ResidentDot[] | null };
  sites: Site[];
  sitesSrc: { data: CityData | null; mission: Mission | null | undefined };
  siteInfo: Map<string, SiteInfo>;
  siteInfoSrc: SiteInfo[] | undefined;
}

const inBbox = (lon: number, lat: number, b: Bbox, pad = 0) =>
  lon >= b[0] - pad && lon <= b[2] + pad && lat >= b[1] - pad && lat <= b[3] + pad;

function timedHubs(result: Result, start: number): TimedHub[] {
  return [...result.placed]
    .sort((a, b) => a.order - b.order)
    .map((h, i) => ({ ...h, dropAt: start + FIRST_DROP + DROP_GAP * i }));
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(props, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [ready, setReady] = useState(false);

  const vsRef = useRef<ViewState>({
    committed: null,
    drift: false,
    hubs: [],
    walkRadius: 0,
    wave: null,
    running: false,
    runResult: null,
    missionId: props.mission?.id ?? null,
    lastToken: props.runToken,
    timers: [],
    flareBorn: new Map(),
    hoveredSite: null,
    hoveredFlare: null,
    resView: null,
    resViewSrc: { arr: null, drift: false },
    resKeyN: 0,
    haze: null,
    hazeSrc: { data: null, bbox: null, arr: null },
    sites: [],
    sitesSrc: { data: null, mission: undefined },
    siteInfo: new Map(),
    siteInfoSrc: undefined,
  });

  const padding = () => propsRef.current.cameraPadding ?? DEFAULT_PADDING;
  const missionBbox = (): Bbox | null => (propsRef.current.mission?.area.bbox as Bbox | undefined) ?? null;

  const cameraToMode = () => {
    const map = mapRef.current;
    if (!map) return;
    const p = propsRef.current;
    const bbox = missionBbox();
    if (p.mode === "mission" && bbox) flyToMission(map, bbox, padding());
    else flyIn(map);
  };

  useImperativeHandle(ref, () => ({
    flyIn: () => mapRef.current && flyIn(mapRef.current),
    flyToMission: () => {
      const bbox = missionBbox();
      if (mapRef.current && bbox) flyToMission(mapRef.current, bbox, padding());
    },
    getMap: () => mapRef.current,
  }));

  // ---- Map + overlay setup (once) ----
  useEffect(() => {
    const el = containerRef.current!;
    const day = !!propsRef.current.dayMode;
    const map = new maplibregl.Map({
      container: el,
      style: { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": day ? MAP_BACKGROUND.day : MAP_BACKGROUND.night } }] },
      center: BHAM_CENTER,
      zoom: 9.3,
      pitch: 0,
      maxPitch: 70,
      preserveDrawingBuffer: true, // lets the Proposal page take a picture of the map
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    applyStyle(day);

    const overlay = new MapboxOverlay({
      interleaved: false,
      deviceProps: { webgl: { preserveDrawingBuffer: true } }, // picture for the Proposal page
      layers: [],
      onHover: (info: PickingInfo) => handleHover(info),
      onClick: (info: PickingInfo) => handleClick(info),
    });
    map.addControl(overlay as unknown as maplibregl.IControl);
    overlayRef.current = overlay;

    map.once("load", () => setReady(true));
    // Start the first camera move right away; tiles fill in as they arrive.
    cameraToMode();

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      renderFrame();
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      vsRef.current.timers.forEach((t) => clearTimeout(t));
      window.clearTimeout(styleRetry.current);
      overlay.finalize();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Day / night style swap ----
  const firstStyle = useRef(true);
  useEffect(() => {
    if (firstStyle.current) {
      firstStyle.current = false;
      return;
    }
    applyStyle(!!props.dayMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.dayMode]);

  // Loads the night/day base style. If the tile server was unreachable we show a plain
  // background and try once more in the background; a later toggle also retries.
  const styleRetry = useRef(0);
  const onFallback = useRef(true); // the map starts on a plain background
  function applyStyle(day: boolean, isRetry = false) {
    const map = mapRef.current;
    if (!map) return;
    window.clearTimeout(styleRetry.current);
    buildMapStyle(day).then((style) => {
      if (mapRef.current !== map || !!propsRef.current.dayMode !== day) return; // stale
      const fallback = isFallbackStyle(style);
      if (fallback && onFallback.current && isRetry) return; // still offline, nothing to swap
      // Diffing between unrelated styles (or before the first one loads) only warns.
      map.setStyle(style, { diff: !onFallback.current && !fallback && !!map.isStyleLoaded() });
      onFallback.current = fallback;
      if (fallback && !isRetry) styleRetry.current = window.setTimeout(() => applyStyle(day, true), STYLE_RETRY_MS);
    });
  }

  // ---- Legend toggles for base-map layers (streets, buildings) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const hidden = propsRef.current.hidden;
      for (const l of map.getStyle()?.layers ?? []) {
        const group = (l.metadata as { group?: LayerGroup } | undefined)?.group;
        if (!group) continue;
        const want = hidden?.has(group) ? "none" : "visible";
        if (map.getLayoutProperty(l.id, "visibility") !== want) map.setLayoutProperty(l.id, "visibility", want);
      }
    };
    if (map.isStyleLoaded()) apply();
    map.on("styledata", apply); // re-apply after a day/night style swap
    return () => {
      map.off("styledata", apply);
    };
  }, [props.hidden]);

  // ---- Camera on mode / mission change ----
  const firstCam = useRef(true);
  useEffect(() => {
    if (firstCam.current) {
      firstCam.current = false;
      return;
    }
    cameraToMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, props.mission?.id]);

  // ---- Results and the Run sequence ----
  useEffect(() => {
    const vs = vsRef.current;
    const result = props.result ?? null;
    const missionId = props.mission?.id ?? null;
    const missionChanged = missionId !== vs.missionId;
    vs.missionId = missionId;
    const isNewRun = props.runToken !== undefined && props.runToken !== vs.lastToken;
    if (isNewRun) {
      vs.lastToken = props.runToken;
      if (result) {
        startRun(result);
        return;
      }
    }
    if (vs.running) {
      if (!missionChanged && result === vs.runResult) return; // same run, keep animating
      cancelRun(); // new level / mission while animating: drop the old sequence
    }
    commitNow(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.runToken, props.result, props.mission?.id]);

  function clearTimers() {
    const vs = vsRef.current;
    vs.timers.forEach((t) => clearTimeout(t));
    vs.timers = [];
  }

  /** Stop a running sequence without finishing it (no onRunComplete). */
  function cancelRun() {
    const vs = vsRef.current;
    clearTimers();
    vs.running = false;
    vs.runResult = null;
    vs.wave = null;
    propsRef.current.onRunStep?.(null);
    propsRef.current.onRunCancel?.();
  }

  function commitNow(result: Result | null) {
    const vs = vsRef.current;
    clearTimers();
    vs.running = false;
    vs.runResult = null;
    vs.committed = result;
    vs.hubs = result ? timedHubs(result, -1e7) : []; // already landed
    vs.walkRadius = result?.walkRadiusMeters ?? 0;
    vs.drift = !!result && result.placed.length > 0;
    vs.wave = null;
  }

  function startRun(result: Result) {
    const vs = vsRef.current;
    const p = propsRef.current;
    clearTimers();
    const later = (ms: number, fn: () => void) => vs.timers.push(window.setTimeout(fn, ms));

    if (!result.ok && result.placed.length === 0) {
      // An error: the map does not change.
      vs.running = false;
      vs.runResult = null;
      p.onRunStep?.(null);
      p.onRunComplete?.();
      return;
    }

    vs.running = true;
    vs.runResult = result;
    vs.wave = null;
    const start = performance.now();
    const bbox = missionBbox();
    if (mapRef.current && bbox && p.mode === "mission") runPushIn(mapRef.current, bbox, padding());

    const hubs = timedHubs(result, start);
    vs.hubs = hubs;
    vs.walkRadius = result.walkRadiusMeters;
    hubs.forEach((h, i) => later(FIRST_DROP + DROP_GAP * i, () => propsRef.current.onRunStep?.({ order: h.order, line: h.line })));

    const flipAt = hubs.length ? FIRST_DROP + DROP_GAP * (hubs.length - 1) + DROP_MS + FLIP_AFTER_LAND : 300;
    later(flipAt, () => {
      propsRef.current.onRunStep?.(null);
      vs.committed = result;
      vs.drift = result.placed.length > 0;
      if (result.goalMet) {
        const b = missionBbox();
        if (b) vs.wave = { center: bboxCenter(b), maxRadius: bboxRadiusMeters(b) * 1.15, startAt: performance.now() + 250 };
      }
    });
    later(flipAt + COMPLETE_AFTER_FLIP, () => {
      vs.running = false;
      vs.runResult = null;
      propsRef.current.onRunComplete?.();
    });
    later(flipAt + 250 + WAVE_MS + 100, () => (vs.wave = null));
  }

  // ---- Picking ----
  function handleHover(info: PickingInfo) {
    const vs = vsRef.current;
    const p = propsRef.current;
    const map = mapRef.current;
    const id = info.layer?.id;
    const obj = info.object as any;
    let siteId: string | null = null;
    let flareId: string | null = null;
    let tip: Tooltip | null = null;

    if (obj && id === "site-discs") {
      const site = obj as Site;
      siteId = site.id;
      const s = vs.siteInfo.get(site.id);
      tip = s
        ? {
            x: info.x,
            y: info.y,
            kind: KIND_LABEL[s.kind],
            name: s.name,
            stats: [
              `${s.families_nearby.toLocaleString()} families nearby`,
              `${s.families_without_car.toLocaleString()} without a car`,
              `${Math.round(s.minutes_to_store)} min walk to a store`,
            ],
            hint: "Click to add to your code",
          }
        : { x: info.x, y: info.y, kind: KIND_LABEL[site.kind], name: site.name };
    } else if (obj && (id === "hub-beam" || id === "hub-base-glow" || id === "hub-labels")) {
      const h = (obj as { hub: TimedHub }).hub;
      tip = { x: info.x, y: info.y, kind: `Hub ${h.order + 1} · ${KIND_LABEL[h.kind]}`, name: h.name };
    } else if (obj && id === "store-glow") {
      tip = { x: info.x, y: info.y, kind: "Grocery store", name: (obj as Store).name };
    } else if (obj && (id === "flare-heads" || id === "flare-labels")) {
      flareId = (obj.f as TimedFlare).id;
    }

    if (siteId !== vs.hoveredSite) {
      vs.hoveredSite = siteId;
      p.onSiteHover?.(siteId ? vs.siteInfo.get(siteId) ?? (obj as Site) : null);
    }
    if (flareId !== vs.hoveredFlare) {
      vs.hoveredFlare = flareId;
      p.onFlareHover?.(flareId ? (p.flares ?? []).find((f) => f.id === flareId) ?? null : null);
    }
    if (map) map.getCanvas().style.cursor = siteId || flareId ? "pointer" : "";
    setTooltip(tip);
  }

  function handleClick(info: PickingInfo) {
    const vs = vsRef.current;
    const p = propsRef.current;
    const id = info.layer?.id;
    const obj = info.object as any;
    if (!obj) return;
    if (id === "site-discs") p.onSiteClick?.(vs.siteInfo.get(obj.id) ?? (obj as Site));
    else if (id === "flare-heads" || id === "flare-labels") {
      const f = (p.flares ?? []).find((x) => x.id === obj.f.id);
      if (f) p.onFlareClick?.(f);
    }
  }

  // ---- Per-frame layer build (cheap: data arrays are memoized) ----
  function renderFrame() {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay) return;
    const p = propsRef.current;
    const vs = vsRef.current;
    const now = performance.now();
    const ctx: FrameCtx = { now, zoom: map.getZoom(), pal: palette(p.dayMode), dayMode: !!p.dayMode };
    const data = p.data;
    const bbox = missionBbox();
    const inMission = p.mode === "mission";
    const comparing = !!p.showBaseline && !vs.running;

    // Which residents are shown.
    let arr: ResidentDot[] | null = null;
    let drift = false;
    if (inMission) {
      if (comparing && p.baselineResult) arr = p.baselineResult.residents;
      else if (vs.committed) {
        arr = vs.committed.residents;
        drift = vs.drift;
      } else if (p.baselineResult) arr = p.baselineResult.residents;
    }
    if (arr !== vs.resViewSrc.arr || drift !== vs.resViewSrc.drift) {
      vs.resViewSrc = { arr, drift };
      vs.resView = arr ? { residents: arr, drift, key: String(++vs.resKeyN) } : null;
    }

    // Need haze over areas in view.
    const hazeBbox = inMission ? bbox : null;
    if (data && (data !== vs.hazeSrc.data || hazeBbox !== vs.hazeSrc.bbox || arr !== vs.hazeSrc.arr)) {
      const areas: Area[] =
        data === vs.hazeSrc.data && hazeBbox === vs.hazeSrc.bbox && vs.haze
          ? vs.haze.areas
          : hazeBbox
            ? data.areas.filter((a) => inBbox(a.center[0], a.center[1], hazeBbox, 0.003))
            : data.areas;
      let farShare: Map<string, number> | null = null;
      if (arr) {
        const tot = new Map<string, [number, number]>();
        for (const r of arr) {
          const c = tot.get(r.areaId) ?? [0, 0];
          c[1]++;
          if (r.status === "far") c[0]++;
          tot.set(r.areaId, c);
        }
        farShare = new Map();
        for (const [k, [far, all]] of tot) farShare.set(k, far / all);
      }
      vs.hazeSrc = { data, bbox: hazeBbox, arr };
      vs.haze = { areas, maxNeed: areas.reduce((m, a) => Math.max(m, a.households_no_car), 0), farShare, key: String(++vs.resKeyN) };
    }

    // Candidate sites in the mission area.
    if (data !== vs.sitesSrc.data || p.mission !== vs.sitesSrc.mission) {
      vs.sitesSrc = { data, mission: p.mission };
      const kinds = p.mission?.siteKinds;
      vs.sites = data && bbox ? data.sites.filter((s) => inBbox(s.lon, s.lat, bbox) && (!kinds || kinds.includes(s.kind))) : [];
    }
    if (p.sites !== vs.siteInfoSrc) {
      vs.siteInfoSrc = p.sites;
      vs.siteInfo = new Map((p.sites ?? []).map((s) => [s.id, s]));
    }

    // Flares: remember when each id first appeared so new ones launch.
    let flares: TimedFlare[] = [];
    if (!inMission && p.flares) {
      flares = p.flares.map((f, i) => {
        let born = vs.flareBorn.get(f.id);
        if (born === undefined) {
          born = now + (vs.flareBorn.size === 0 ? 1800 + i * 350 : 0);
          vs.flareBorn.set(f.id, born);
        }
        return { ...f, bornAt: born };
      });
    }

    // Hub ground rings go under the residents; beams and labels go over them.
    const on = (g: LayerGroup) => !p.hidden?.has(g);
    let hub: ReturnType<typeof hubLayers> = [];
    if (inMission && !comparing && vs.hubs.length && on("hubs")) {
      const fullLabel = layoutHubLabels(vs.hubs, (lon, lat) => {
        const pt = map.project([lon, lat]);
        return [pt.x, pt.y];
      });
      hub = hubLayers(vs.hubs, vs.walkRadius, ctx, fullLabel);
    }
    const layers: any[] = [];
    if (vs.haze && on("need")) layers.push(hazeLayer(vs.haze, ctx));
    layers.push(...hub.slice(0, 3));
    if (inMission) layers.push(...waveLayers(vs.wave, ctx));
    if (data && on("stores")) layers.push(...storeLayers(data.stores, ctx));
    if (inMission && vs.sites.length && on("sites")) layers.push(...siteLayers(vs.sites, vs.hoveredSite, ctx));
    if (vs.resView && on("residents")) layers.push(residentsLayer(vs.resView, ctx));
    layers.push(...hub.slice(3));
    if (flares.length) layers.push(...flareLayers(flares, vs.hoveredFlare, ctx));
    overlay.setProps({ layers });
  }

  return (
    <div className={`mcc-map${props.dayMode ? " day" : ""}`} data-ready={ready || undefined}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {tooltip && (
        <div className="mcc-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="pop-kind">{tooltip.kind}</div>
          <div className="pop-name">{tooltip.name}</div>
          {tooltip.stats && (
            <div className="pop-stats">
              {tooltip.stats.map((t) => <span key={t}>{t}</span>)}
            </div>
          )}
          {tooltip.hint && <div className="pop-hint">{tooltip.hint}</div>}
        </div>
      )}
    </div>
  );
});
