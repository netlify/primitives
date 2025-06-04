import { createMockLogger } from '@netlify/dev-utils'
import { imageSize } from 'image-size'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { ImageHandler } from './main.js'
import { createIPXWebServer } from 'ipx'

const mockedIpxResponse = new Response('Mocked response from IPX')

vi.mock('ipx', async () => {
  return {
    ...(await vi.importActual('ipx')),
    createIPXWebServer: vi.fn(() => () => Promise.resolve(mockedIpxResponse.clone())),
  }
})

const mockCreateIPXWebServer = vi.mocked(createIPXWebServer)

beforeEach(() => {
  mockCreateIPXWebServer.mockReset()
})

describe('`ImageHandler`', () => {
  describe('constructor', () => {
    test('warns about malformed remote image patterns', () => {
      const logger = { ...createMockLogger(), warn: vi.fn() }

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
    describe('image endpoints', () => {
      test('matches on `/.netlify/images', async () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          originServerAddress: 'http://localhost:5173',
        })

        const url = new URL('/.netlify/images', 'https://netlify.com')
        url.searchParams.set('url', 'image.png')

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(true)
        expect(response).toMatchObject(mockedIpxResponse)
      })

      test('matches on `/.netlify/images/', async () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          originServerAddress: 'http://localhost:5173',
        })

        const url = new URL('/.netlify/images/', 'https://netlify.com')
        url.searchParams.set('url', 'image.png')

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(true)
        expect(response).toMatchObject(mockedIpxResponse)
      })

      test('does not match on `/.netlify/foo', () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
        })

        const url = new URL('/.netlify/foo', 'https://netlify.com')
        url.searchParams.set('url', 'image.png')

        const match = imageHandler.match(new Request(url))

        expect(match).not.toBeDefined()
      })
    })

    describe('request methods', () => {
      test('allows GET requests', async () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          originServerAddress: 'http://localhost:5173',
        })

        const url = new URL('/.netlify/images', 'https://netlify.com')
        url.searchParams.set('url', 'image.png')

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(true)
        expect(response).toMatchObject(mockedIpxResponse)
      })

      test('does not allow POST requests', async () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
        })

        const url = new URL('/.netlify/images', 'https://netlify.com')
        url.searchParams.set('url', 'image.png')

        const match = imageHandler.match(new Request(url, { method: 'POST' }))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(false)
        expect(await response.text()).toBe('Method Not Allowed')
      })
    })

    describe('remote images', () => {
      test('allow remote images matching configured patterns', async () => {
        mockCreateIPXWebServer.mockImplementation(
          (await vi.importActual<typeof import('ipx')>('ipx')).createIPXWebServer,
        )

        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          imagesConfig: {
            remote_images: ['https://images.unsplash.com/.*'],
          },
        })

        const requestedWidth = 100

        const url = new URL('/.netlify/images', 'https://netlify.com')
        url.searchParams.set('url', 'https://images.unsplash.com/photo-1517849845537-4d257902454a')
        url.searchParams.set('w', requestedWidth.toString())

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(true)

        const { width } = imageSize(new Uint8Array(await response.arrayBuffer()))

        expect(width).toBe(requestedWidth)
      }, 30_000)

      test('does not allow remote images not matching configured patterns', async () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          imagesConfig: {
            remote_images: [],
          },
        })

        const url = new URL('/.netlify/images', 'https://netlify.com')
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
