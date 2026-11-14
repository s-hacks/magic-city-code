import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { makeStyle, type LayerGroup } from './style';
import type { ThemeName } from '../theme';
import {
  BIRMINGHAM, baseline, distM, litSet, mission, neighborhoods, offset, residents, shelters, sites, stores,
  type LngLat, type Problem, type Site,
} from '../data/mock';

// Shared with the code panel so the line highlight stays in step with the beams.
export const RUN_START_MS = 200;
export const HUB_STEP_MS = 300;
const BEAM_MS = 700;
const RING_MS = 1300;
const BEAM_H = 380; // meters
const HOME_HIDDEN: LayerGroup[] = ['sites', 'stores', 'shelters', 'hubs']; // keep the home view calm: just lights + flares
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Screen = 'home' | 'mission';
interface Props {
  theme: ThemeName;
  screen: Screen;
  hidden: Set<LayerGroup>;
  problems: Problem[];
  hubs: Site[];
  runId: number;
  compare: boolean;
  onFlare: (p: Problem) => void;
  onSiteClick: (s: Site) => void;
}

const fc = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });
const pt = (at: LngLat, properties: Record<string, unknown> = {}, id?: number): Feature => ({ type: 'Feature', id, properties, geometry: { type: 'Point', coordinates: at } });
const circle = (c: LngLat, r: number, n = 48): Polygon => ({
  type: 'Polygon',
  coordinates: [Array.from({ length: n + 1 }, (_, i) => offset(c, r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI)))],
});
const ease = (x: number) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
const el = (tag: string, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text) e.textContent = text; // never innerHTML: names will come from OSM / residents
  return e;
};

export default function MapView({ theme, screen, hidden, problems, hubs, runId, compare, onFlare, onSiteClick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const ready = useRef<Promise<MLMap> | null>(null);
  const litNow = useRef<Set<number>>(baseline);
  const cb = useRef({ onFlare, onSiteClick });
  cb.current = { onFlare, onSiteClick };

  // --- create once --------------------------------------------------------
  useEffect(() => {
    const m = new maplibregl.Map({
      container: box.current!,
      style: makeStyle(theme),
      center: [-92, 36],
      zoom: 2.4,
      attributionControl: { compact: true },
      maxPitch: 75,
    });
    map.current = m;
    ready.current = new Promise((res) => m.on('load', () => res(m)));

    ready.current.then(() => {
      (m.getSource('residents') as GeoJSONSource).setData(fc(residents.map((r) => pt(r.at, { id: r.id }, r.id))));
      (m.getSource('stores') as GeoJSONSource).setData(fc(stores.map((s) => pt(s.at, { name: s.name }))));
      (m.getSource('shelters') as GeoJSONSource).setData(fc(shelters.map((s) => pt(s.at, { name: s.name }))));
      (m.getSource('sites') as GeoJSONSource).setData(fc(sites.map((s, i) => pt(s.at, { id: i }, i))));
      paintLit(m, baseline);

      for (const n of neighborhoods) new maplibregl.Marker({ element: el('div', 'nb-label', n.name) }).setLngLat(n.at).addTo(m);

      // hover + click on possible hub sites
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'site-pop' });
      let hovered: number | null = null;
      const setHover = (id: number | null) => {
        if (hovered !== null) m.setFeatureState({ source: 'sites', id: hovered }, { hover: false });
        hovered = id;
        if (id !== null) m.setFeatureState({ source: 'sites', id }, { hover: true });
      };
      m.on('mousemove', 'sites', (e) => {
        const id = Number(e.features?.[0]?.id);
        if (id === hovered) return;
        setHover(id);
        const s = sites[id];
        const body = el('div', 'pop');
        body.append(el('div', 'pop-kind', s.kind), el('div', 'pop-name', s.name));
        const stats = el('div', 'pop-stats');
        stats.append(el('span', '', `${s.families_nearby.toLocaleString()} families nearby`), el('span', '', `${s.families_without_car.toLocaleString()} without a car`));
        body.append(stats, el('div', 'pop-hint', 'Click to add to your code'));
        popup.setLngLat(s.at).setDOMContent(body).addTo(m);
        m.getCanvas().style.cursor = 'pointer';
      });
      m.on('mouseleave', 'sites', () => { setHover(null); popup.remove(); m.getCanvas().style.cursor = ''; });
      m.on('click', 'sites', (e) => cb.current.onSiteClick(sites[Number(e.features?.[0]?.id)]));
    });

    // slow idle orbit on the home screen
    let raf = 0;
    const spin = () => {
      if (m.getContainer().dataset.screen === 'home' && !m.isMoving() && !reduceMotion) m.setBearing(m.getBearing() + 0.025);
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    return () => { cancelAnimationFrame(raf); m.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- theme --------------------------------------------------------------
  useEffect(() => {
    ready.current?.then((m) => {
      const s = makeStyle(theme);
      for (const l of s.layers) for (const [k, v] of Object.entries((l as { paint?: object }).paint ?? {})) m.setPaintProperty(l.id, k as never, v as never);
      m.setSky(s.sky!);
      m.setLight(s.light!);
    });
  }, [theme]);

  // --- layer toggles (+ compare hides hubs) --------------------------------
  useEffect(() => {
    ready.current?.then((m) => {
      for (const l of m.getStyle().layers) {
        const group = (l.metadata as { group?: LayerGroup } | undefined)?.group;
        if (!group) continue;
        const off = hidden.has(group) || (group === 'hubs' && compare) || (screen === 'home' && HOME_HIDDEN.includes(group));
        m.setLayoutProperty(l.id, 'visibility', off ? 'none' : 'visible');
      }
    });
  }, [hidden, compare, screen]);

  // --- camera per screen -----------------------------------------------------
  useEffect(() => {
    box.current!.dataset.screen = screen;
    ready.current?.then((m) => {
      const first = m.getZoom() < 5;
      if (screen === 'home') m.flyTo({ center: BIRMINGHAM, zoom: 12.2, pitch: 52, bearing: -18, padding: { left: Math.min(window.innerWidth * 0.42, 640), top: 0, right: 0, bottom: 0 }, duration: first ? 6500 : 2600, curve: 1.6, essential: true });
      else m.flyTo({ padding: { left: 380, top: 60, right: Math.min(window.innerWidth * 0.4, 500), bottom: 80 }, center: mission.center, zoom: 13.55, pitch: 58, bearing: -28, duration: first ? 4000 : 2600, essential: true });
    });
  }, [screen]);

  // --- problem flares (home only) -------------------------------------------
  useEffect(() => {
    if (screen !== 'home') return;
    const markers: maplibregl.Marker[] = [];
    ready.current?.then((m) => {
      problems.forEach((p, i) => {
        const root = el('button', `flare${p.missionId ? ' has-mission' : ''}`);
        root.style.setProperty('--delay', `${2.2 + i * 0.18}s`);
        root.setAttribute('aria-label', `${p.label}, ${p.neighborhood}`);
        const card = el('div', 'flare-card');
        card.append(el('div', 'flare-hood', p.neighborhood), el('div', 'flare-quote', `“${p.quote}”`), el('div', 'flare-cta', p.missionId ? 'Open mission →' : 'Mission in the works'));
        root.append(el('span', 'flare-beam'), el('span', 'flare-dot'), el('span', 'flare-label', p.label), card);
        root.addEventListener('click', () => cb.current.onFlare(p));
        markers.push(new maplibregl.Marker({ element: root, anchor: 'bottom' }).setLngLat(p.at).addTo(m));
      });
    });
    return () => markers.forEach((mk) => mk.remove());
  }, [screen, problems]);

  // --- run animation: beams drop, rings ripple, residents light as rings pass ---
  useEffect(() => {
    if (!runId) return;
    let raf = 0;
    ready.current?.then((m) => {
      const target = litSet(hubs.map((h) => h.at));
      litNow.current = target;
      paintLit(m, baseline);
      const pending = residents.filter((r) => target.has(r.id) && !baseline.has(r.id));
      const t0 = performance.now();
      const beams = m.getSource('hubBeams') as GeoJSONSource;
      const points = m.getSource('hubPoints') as GeoJSONSource;
      const rings = m.getSource('rings') as GeoJSONSource;

      const frame = (now: number) => {
        const radii = hubs.map((h, i) => {
          const t = reduceMotion ? 1e6 : now - t0 - RUN_START_MS - i * HUB_STEP_MS;
          return { h, t, beam: ease(t / BEAM_MS), ring: ease((t - 200) / RING_MS) };
        });
        const live = radii.filter((r) => r.t > 0);
        beams.setData(fc(live.map((r) => ({ type: 'Feature', properties: { h: BEAM_H * r.beam }, geometry: circle(r.h.at, 22, 16) }))));
        points.setData(fc(live.map((r) => pt(r.h.at, { o: r.beam }))));
        rings.setData(fc(live.filter((r) => r.t > 200).map((r) => ({ type: 'Feature', properties: { o: 1 - 0.55 * r.ring }, geometry: circle(r.h.at, mission.walkMeters * r.ring) }))));

        for (let k = pending.length - 1; k >= 0; k--) {
          const r = pending[k];
          if (radii.some((x) => distM(r.at, x.h.at) <= mission.walkMeters * x.ring)) {
            m.setFeatureState({ source: 'residents', id: r.id }, { lit: true });
            pending.splice(k, 1);
          }
        }
        const done = radii.every((r) => r.ring >= 1);
        if (!done) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // --- hold to compare: show today's city -----------------------------------
  useEffect(() => {
    ready.current?.then((m) => paintLit(m, compare ? baseline : litNow.current));
  }, [compare]);

  return <div ref={box} className="map" aria-label="3D map of Birmingham at night" role="img" />;
}

function paintLit(m: MLMap, lit: Set<number>) {
  for (const r of residents) m.setFeatureState({ source: 'residents', id: r.id }, { lit: lit.has(r.id) });
}
