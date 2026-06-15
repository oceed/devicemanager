import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8081,
    host: '0.0.0.0', // Bind to all interfaces for local LAN access
    proxy: {
      '/api': {
        target: 'http://localhost:8011',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
