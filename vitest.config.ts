import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src/renderer') },
  },
  test: {
    globals: true,
    environmentMatchGlobs: [
      ['src/renderer/**', 'jsdom'],
      ['netlify/**', 'node'],
    ],
    environment: 'node',
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/*.test.ts',
      'netlify/**/__tests__/**/*.test.ts',
    ],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
})
