import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  envDir: resolve(__dirname),
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: resolve(__dirname, 'tailwind.config.js') }),
        autoprefixer(),
      ],
    },
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        dictation: resolve(__dirname, 'src/renderer/dictation.html'),
        settings: resolve(__dirname, 'src/renderer/settings.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'dist/', 'src/renderer/'],
    },
  },
})
