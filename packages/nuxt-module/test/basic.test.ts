import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

describe('ssr', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
    dev: true,
    // Disable WebSocket server and HMR to prevent port conflicts in parallel testing
    // See: https://github.com/vitejs/vite/pull/16219
    nuxtConfig: {
      vite: {
        server: {
          ws: false,
          hmr: false,
        },
      },
    },
  })

  it('renders the index page', async () => {
    const html = await $fetch('/')
    expect(html).toContain('<div>basic</div>')
  })
})
