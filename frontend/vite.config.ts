import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
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
      '/cok/api': {
        target: process.env.VITE_API_URL || 'http://localhost:2026' //'https://cok-bc.onrender.com',
        ,
        changeOrigin: true,
        secure: process.env.VITE_API_URL ? true : false,
        // Don't rewrite the path - keep /cok/api
      },
    },
  },
})