import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react()
  ],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      '/api/spotify': {
        target: `http://127.0.0.1:${process.env.BACKEND_PORT || 8000}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  }
})