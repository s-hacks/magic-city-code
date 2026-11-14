// Landing page dev server and build: a separate site from the app (which is vite.config.ts on
// 5173). Serves landing.html at "/" on port 5180, shares /public (data) and /api with the app.
// Links into the app use VITE_APP_URL (default http://localhost:5173).
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** In dev, "/" (and any page path) serves landing.html instead of index.html. */
const landingAtRoot: Plugin = {
  name: "landing-at-root",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url ?? "/").split("?")[0];
      if (path === "/" || path === "/index.html") req.url = "/landing.html";
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), landingAtRoot],
  // Its own dependency cache, so running next to the app server does not re-optimize both.
  cacheDir: "node_modules/.vite-landing",
  server: {
    port: 5180,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  build: {
    outDir: "dist-landing",
    rollupOptions: { input: "landing.html" },
  },
});
