import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 15_000,
    hookTimeout: 30_000,
    env: {
      // See https://github.com/webdiscus/ansis/?tab=readme-ov-file#disable-colors-in-tests
      NO_COLOR: 'true',
    },
  },
})
