import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/auth": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/clients": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/invoices": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/quotes": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/credit-notes": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/refunds": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/agreements": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/proposals": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/expenses": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/settings": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/email": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/tax": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/admin": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
