import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 🟢 Allows testing on your mobile phone via local IP
    host: true, 
    port: 5173,
    // 🟢 Ensures headers don't block Google Identity Services
    headers: {
      "Referrer-Policy": "no-referrer-when-downgrade",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  preview: {
    // 🟢 Match settings for production previews
    host: true,
    port: 5173,
    headers: {
      "Referrer-Policy": "no-referrer-when-downgrade",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  build: {
    // 🟢 Optimization for deployment
    outDir: 'dist',
    sourcemap: false,
  }
})