import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Some of this package's tests are slow on Windows
    testTimeout: 10_000,
  },
})
