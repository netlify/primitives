import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    target: 'esnext',
  },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
