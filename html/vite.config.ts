import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/html/index.html'),
        demo: resolve(__dirname, 'src/html/demo.html'),
        register: resolve(__dirname, 'src/html/register.html'),
      },
    },
  },
})
