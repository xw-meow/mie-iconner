import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 部署在 GitHub Pages 项目子路径下(xw-meow.github.io/mie-iconner/);
  // 若以后换自定义域名,改回 '/' 即可
  base: '/mie-iconner/',
})
