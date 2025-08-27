import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    target: 'esnext',
  },
  test: {
    include: ['(src|dev)/**/*.test.ts'],
    testTimeout: 30_000,
    typecheck: {
      enabled: true,
    },
  },
})
