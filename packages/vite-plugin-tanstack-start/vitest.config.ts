import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 15_000,
    // e2e fixture install & deploy time is highly variable on GitHub's CI infra, especially Windows :(
    hookTimeout: (process.platform === 'win32' ? 10 : 5) * 60_000,
    env: {
      // See https://github.com/webdiscus/ansis/?tab=readme-ov-file#disable-colors-in-tests
      NO_COLOR: 'true',
    },
  },
})
