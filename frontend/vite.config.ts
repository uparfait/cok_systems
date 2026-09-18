import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'path'

const requireFrom = createRequire(import.meta.url)

// MapLibre works out where its worker lives AT RUNTIME - it builds the URL
// from its own module's location, `new URL("./maplibre-gl-worker.mjs",
// import.meta.url)` - so no bundler ever sees a reference to it and none of
// them emits the file. On a dev server that is harmless, because the real
// package is served straight off disk. On a HOSTED build the request lands
// on a file that was never written, the single-page fallback answers with
// index.html, and the browser refuses it: "Failed to load module script:
// the server responded with a non-JavaScript MIME type of text/html".
//
// So the two files MapLibre expects to find beside its bundle are copied
// there, unhashed and under the names it asks for - the worker, and the
// shared chunk the worker itself imports. Copied from the installed package
// at build time rather than kept in public/, so they can never drift out of
// step with the version in package.json.
const MAPLIBRE_RUNTIME_FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

function maplibreWorkerAssets(): Plugin {
  let resolved: ResolvedConfig
  return {
    name: 'dcs:maplibre-worker-assets',
    apply: 'build',
    configResolved(config) {
      resolved = config
    },
    generateBundle() {
      const dist = path.dirname(requireFrom.resolve('maplibre-gl/dist/maplibre-gl.mjs'))
      for (const name of MAPLIBRE_RUNTIME_FILES) {
        const from = path.join(dist, name)
        if (!fs.existsSync(from)) {
          // A MapLibre upgrade that renames these would silently break the
          // map on the server only, which is the worst place to find out.
          this.error(`maplibre-gl no longer ships ${name}; the map worker would 404 once deployed`)
        }
        this.emitFile({
          type: 'asset',
          fileName: path.posix.join(resolved.build.assetsDir, name),
          source: fs.readFileSync(from),
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    maplibreWorkerAssets(),
  ],

  // MapLibre loads its own worker from inside its package; the dependency
  // optimizer rewrites that away and the worker file then cannot be found,
  // so the map is served as it ships.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 5173,
    host: process.env.VITE_DEV_SERVER_HOST || '0.0.0.0',
    proxy: {
      '/cok/api/v1': {
        
        target: process.env.VITE_API_EVENT_URL || 'http://localhost:2027',
        changeOrigin: true,
        secure: !!process.env.VITE_API_EVENT_URL,
      },

      '/cok/api': {
        target: process.env.VITE_API_URL || 'http://localhost:2026',
        changeOrigin: true,
        secure: !!process.env.VITE_API_URL,
      },

      '/dcs/api': {
        target: process.env.VITE_API_DCS_URL || 'http://localhost:8765',
        changeOrigin: true,
        secure: !!process.env.VITE_API_DCS_URL,
      },
    },
  },
})