import { defineConfig } from 'vitest/config'

export default defineConfig({
  esbuild: {
    target: 'esnext',
  },
  resolve: {
    alias: {
      // This fixes a really strange issue where vitest treats the `stream`
      // specifier as a relative import and fails. It's possible that new
      // versions of vitest will fix the problem, so you can try to remove
      // this and check if the tests still pass.
      stream: 'node:stream',
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
    typecheck: {
      enabled: true,
    },
  },
})
