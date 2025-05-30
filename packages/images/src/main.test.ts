import type { Logger } from '@netlify/dev-utils'
import { imageSize } from 'image-size'
import { describe, expect, test, vi } from 'vitest'
import { ImageHandler } from './main.js'

function getMockLogger(): Logger {
  return {
    error: vi.fn<Logger['error']>(),
    warn: vi.fn<Logger['warn']>(),
    log: vi.fn<Logger['log']>(),
  }
}

describe('`ImageHandler`', () => {
  describe('constructor', () => {
    test('warns about malformed remote image patterns', () => {
      const logger = getMockLogger()

      new ImageHandler({
        logger,
        imagesConfig: {
          remote_images: ['https://example.com/images/.*', 'invalid-regex['],
        },
      })

      expect(logger.warn).toHaveBeenCalledWith(
        'Malformed remote image pattern: "invalid-regex[": Invalid regular expression: /invalid-regex[/: Unterminated character class. Skipping it.',
      )
    })
  })

  describe('match', () => {
    describe('remote images', () => {
      test('allow remote images matching configured patterns', async () => {
        const imageHandler = new ImageHandler({
          logger: getMockLogger(),
          imagesConfig: {
            remote_images: ['https://images.unsplash.com/.*'],
          },
        })

        const url = new URL('https://netlify.com/.netlify/images')
        url.searchParams.set('url', 'https://images.unsplash.com/photo-1517849845537-4d257902454a')
        url.searchParams.set('w', '100')

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(true)

        const { width } = imageSize(await response.bytes())

        expect(width).toBe(100)
      }, 30_000)

      test('does not allow remote images not matching configured patterns', async () => {
        const imageHandler = new ImageHandler({
          logger: getMockLogger(),
          imagesConfig: {
            remote_images: [],
          },
        })

        const url = new URL('https://netlify.com/.netlify/images')
        url.searchParams.set('url', 'https://images.unsplash.com/photo-1517849845537-4d257902454a')
        url.searchParams.set('w', '100')

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.status).toBe(403)
        expect(await response.text()).toBe('Forbidden: Remote image URL not allowed')
      })
    })
  })
})
