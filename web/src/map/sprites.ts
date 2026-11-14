// Small image assets made in code, so the map needs no image files.
// - glowAtlas: one soft round light (bright core, soft halo). Tinted per dot via IconLayer mask.
// - siteIcon(kind): white SVG pictograms for church / school / library / rec center.
import type { SiteKind } from "@mcc/shared";

let glowUrl: string | null = null;

/** A 64x64 radial gradient: white core fading to transparent. Used as an IconLayer mask. */
export function glowAtlas(): string {
  if (glowUrl) return glowUrl;
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.16, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.55)");
  g.addColorStop(0.55, "rgba(255,255,255,0.18)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowUrl = c.toDataURL();
  return glowUrl;
}

export const GLOW_MAPPING = { glow: { x: 0, y: 0, width: 64, height: 64, mask: true } };

const PATHS: Record<SiteKind, string> = {
  // Church: a cross over a small roof.
  church: `<path d="M14 3h4v5h5v4h-5v4h-4v-4H9V8h5z"/><path d="M6 29V19l10-5 10 5v10h-7v-6h-6v6z"/>`,
  // School: a building with a flag.
  school: `<path d="M15 3h2v3h6l-2 2 2 2h-6v2h-2z"/><path d="M4 29V17l12-5 12 5v12h-8v-7h-8v7z"/>`,
  // Library: an open book.
  library: `<path d="M3 7c5-1 9 0 12 2v18c-3-2-7-3-12-2z"/><path d="M29 7c-5-1-9 0-12 2v18c3-2 7-3 12-2z"/>`,
  // Community / rec center: two people.
  community_center: `<circle cx="10" cy="9" r="4"/><circle cx="22" cy="9" r="4"/><path d="M2 27c0-6 4-10 8-10s8 4 8 10z"/><path d="M14 27c0-6 4-10 8-10s8 4 8 10z"/>`,
};

const iconCache = new Map<string, string>();

/** A white 32x32 SVG for a site kind, as a data URL (IconLayer auto-packs these). */
export function siteIconUrl(kind: SiteKind): string {
  let url = iconCache.get(kind);
  if (!url) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" fill="#fff">${PATHS[kind] ?? PATHS.community_center}</svg>`;
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    iconCache.set(kind, url);
  }
  return url;
}

export const KIND_LABEL: Record<SiteKind, string> = {
  church: "church",
  school: "school",
  library: "library",
  community_center: "rec center",
};
