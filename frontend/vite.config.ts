import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

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