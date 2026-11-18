import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Tauri 会把 dev server 固定跑在 1420 端口；HMR 走同一个 WebSocket。
// 这里给出与 Tauri 官方模板一致的约束：端口不对直接失败，避免
// 窗口静默连到别的服务上。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    // macOS 14 WKWebView 足够新；限定 target 让产物更小更稳
    target: 'safari16',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },
})
