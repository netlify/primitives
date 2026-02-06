import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      // See https://github.com/webdiscus/ansis/?tab=readme-ov-file#disable-colors-in-tests
      NO_COLOR: 'true',
    },
    // Some of this package's tests are slow on Windows
    testTimeout: 20_000,
  },
})
