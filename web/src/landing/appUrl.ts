// The landing page is its own site (landing.html, port 5180 in dev). Links into the app go to
// the app's address: VITE_APP_URL when set (for a deployed app), otherwise the app's dev server.
const APP_URL = ((import.meta.env.VITE_APP_URL as string | undefined) ?? "http://localhost:5173").replace(/\/+$/, "");

/** Full URL of an app page, e.g. appHref("/mission/feed-the-block"). */
export const appHref = (path: string) => APP_URL + path;
