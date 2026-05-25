import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:18092',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:18092',
        changeOrigin: true,
      },
    },
  },
})
