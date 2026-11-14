// Vite config: React plugin, /api proxied to the Express server, workers as ES modules.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 127.0.0.1, not localhost: the server listens on IPv4 loopback only.
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
  worker: { format: "es" },
  test: { environment: "node" },
} as any);
