import type { Logger } from '@netlify/dev-utils'
import { describe, expect, test, vi } from 'vitest'
import { ImageHandler } from './main.js'

describe('`ImageHandler`', () => {
  describe('constructor', () => {
    test('warns about malformed remote image patterns', () => {
      const logger = {
        error: vi.fn<Logger['error']>(),
        warn: vi.fn<Logger['warn']>(),
        log: vi.fn<Logger['log']>(),
      } satisfies Logger

      new ImageHandler({
        logger,
        imagesConfig: {
          remote_images: ['https://example.com/images/*', 'invalid-regex['],
        },
      })

      expect(logger.warn).toHaveBeenCalledWith(
        'Malformed remote image pattern: "invalid-regex[": Invalid regular expression: /invalid-regex[/: Unterminated character class. Skipping it.',
      )
    })
  })
})
