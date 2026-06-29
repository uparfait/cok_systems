import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

// Create __dirname equivalent for modern environments/ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Explicitly load env variables so process.env works reliably inside the config
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react({
        // This configuration structure cleanly satisfies Vite's TypeScript types for Babel
        babel: {
          plugins: [
            ["babel-plugin-react-compiler", {}]
          ],
        },
      }),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        // 1. Specific paths first
        '/cok/api/v1': {
          target: env.VITE_API_URL || 'http://localhost:2027',
          changeOrigin: true,
          secure: !!env.VITE_API_URL,
        },
        // 2. Generic paths second
        '/cok/api': {
          target: env.VITE_API_URL || 'http://localhost:2026',
          changeOrigin: true,
          secure: !!env.VITE_API_URL,
        },
        '/uploads': {
          target: env.VITE_API_URL || 'http://localhost:2026',
          changeOrigin: true,
          secure: !!env.VITE_API_URL,
        },
      },
    },
  }
})