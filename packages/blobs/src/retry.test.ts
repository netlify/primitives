import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

test('does not access the process environment during import', async () => {
  vi.stubGlobal('process', {
    get env() {
      throw new Error('Environment access is not allowed')
    },
  })

  await expect(import('./retry.ts')).resolves.toHaveProperty('fetchAndRetry')
})
