// One source of truth for color: CSS variables and the map style both read from here.
// Palette "Magic City After Dark": deep indigo night, a violet → blue → cyan brand gradient,
// and three signal colors with fixed meaning everywhere:
//   blue/cyan = explored by your code · gold = your route / lit · orange = problems & floods.

export type ThemeName = 'night' | 'day';

export const themes = {
  night: {
    bg: '#070A1C',
    surface: '#0D1230',
    raised: '#161D47',
    line: '#262F6B',
    ash: '#4B5590', // unreached / quiet UI
    muted: '#9CA5DB',
    text: '#F0F2FF',
    accent: '#FFC53D', // gold: route, lit, success moments
    accentInk: '#1C1300',
    blue: '#4D7CFF',
    cyan: '#3EE6FF',
    violet: '#9B6BFF',
    pink: '#FF5CAA',
    orange: '#FF7A2F',
    red: '#FF4D6A',
    green: '#2EE6A6',
    // map
    land: '#0A0E2A',
    water: '#123E8C',
    park: '#0E3A3A',
    road: '#1F2A66',
    roadMajor: '#3B3FA6',
    buildingLow: '#151B4A',
    buildingHigh: '#6A45C9',
    sky: '#060818',
    horizon: '#5A1E78', // violet-magenta dusk on the horizon
    store: '#F0F2FF',
    glass: 'rgba(13, 18, 48, 0.74)',
  },
  day: {
    // Projector fallback (D key): same signal colors on light, cool neutrals.
    bg: '#EEF0FA',
    surface: '#FFFFFF',
    raised: '#F3F4FB',
    line: '#D5D9F0',
    ash: '#8C93BC',
    muted: '#4E5582',
    text: '#0E1230',
    accent: '#E8A200',
    accentInk: '#FFFFFF',
    blue: '#2F5BEA',
    cyan: '#0096C7',
    violet: '#6D3FE0',
    pink: '#D93A86',
    orange: '#F05A0A',
    red: '#E02D4F',
    green: '#0FA875',
    land: '#E9ECF8',
    water: '#A9C4F5',
    park: '#C9E9DF',
    road: '#FFFFFF',
    roadMajor: '#DCD6FF',
    buildingLow: '#DADDF0',
    buildingHigh: '#B9A8F0',
    sky: '#DDE3FA',
    horizon: '#F6D9EC',
    store: '#0E1230',
    glass: 'rgba(255, 255, 255, 0.82)',
  },
} as const;

export type Theme = (typeof themes)[ThemeName];

export function applyCssVars(name: ThemeName) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themes[name])) root.style.setProperty(`--${k}`, v);
  root.dataset.theme = name;
}
