import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 使用相对路径 './' 可以适配大多数 GitHub Pages 部署场景（非根域名部署）
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});