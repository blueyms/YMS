import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/YMS/',
  build: { outDir: 'dist', assetsDir: 'assets' },
  // 本地开发/预览时把 /api 转发到本机表单服务，方便同源调试
  server: {
    strictPort: false,
    proxy: { '/api': 'http://localhost:8787' }
  },
  preview: {
    proxy: { '/api': 'http://localhost:8787' }
  }
})
