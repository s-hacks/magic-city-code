// One source of truth for color: CSS variables and the map style both read from here.
// Concept: graphite neutrals + ONE molten accent (Birmingham's iron & steel, the Vulcan forge).
// Everything "lit" (residents reached, hubs, meter, Run) is molten; everything else stays ash.

export type ThemeName = 'night' | 'day';

export const themes = {
  night: {
    bg: '#09090B',
    surface: '#141418',
    raised: '#1D1D23',
    line: '#2A2A32',
    ash: '#5C5C66', // unreached residents, quiet UI
    muted: '#9A9AA5',
    text: '#EDEDF0',
    accent: '#FF5A1F', // molten iron
    accentInk: '#140600', // text on accent
    // map-only
    land: '#0C0C0F',
    water: '#030304',
    park: '#101013',
    road: '#26262D',
    roadMajor: '#3A3A44',
    buildingLow: '#16161B',
    buildingHigh: '#3B3B46',
    sky: '#050506',
    horizon: '#3D1406', // furnace glow on the horizon
    store: '#F4F4F6',
    glass: 'rgba(20, 20, 24, 0.72)',
  },
  day: {
    // Projector fallback (D key): same accent, light neutrals.
    bg: '#E9E9EC',
    surface: '#F7F7F8',
    raised: '#FFFFFF',
    line: '#D3D3D9',
    ash: '#8A8A94',
    muted: '#55555F',
    text: '#111114',
    accent: '#F04E0F',
    accentInk: '#FFFFFF',
    land: '#E4E4E8',
    water: '#C9CBD2',
    park: '#DCDDE1',
    road: '#FFFFFF',
    roadMajor: '#F7F7F8',
    buildingLow: '#D6D6DC',
    buildingHigh: '#B4B4BE',
    sky: '#DADBE0',
    horizon: '#F6E3D9',
    store: '#111114',
    glass: 'rgba(247, 247, 248, 0.8)',
  },
} as const;

export type Theme = (typeof themes)[ThemeName];

export function applyCssVars(name: ThemeName) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themes[name])) root.style.setProperty(`--${k}`, v);
  root.dataset.theme = name;
}
