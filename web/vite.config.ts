import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // MapLibre v6 loads its worker from a path next to its own module; pre-bundling breaks that path.
  optimizeDeps: { exclude: ['maplibre-gl'] },
})
