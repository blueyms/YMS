import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/YMS/',
  build: { outDir: 'dist', assetsDir: 'assets' },
  server: { strictPort: false }
})
