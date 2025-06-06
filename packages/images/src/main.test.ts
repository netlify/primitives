import { createImageServerHandler, createMockLogger, getImageResponseSize, HTTPServer } from '@netlify/dev-utils'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createIPXWebServer } from 'ipx'

import { ImageHandler } from './main.js'

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

    describe('local images', () => {
      let originServerAddress: string
      let originServer: HTTPServer

      const LOCAL_IMAGE_PATH = '/local/image.jpg'
      const LOCAL_IMAGE_WIDTH = 800
      const LOCAL_IMAGE_HEIGHT = 400

      beforeAll(async () => {
        originServer = new HTTPServer(
          createImageServerHandler((url: URL) => {
            if (url.pathname === LOCAL_IMAGE_PATH) {
              return { width: LOCAL_IMAGE_WIDTH, height: LOCAL_IMAGE_HEIGHT }
            }
            return null
          }),
        )

        originServerAddress = await originServer.start()
      })

      afterAll(async () => {
        await originServer.stop()
      })

      beforeEach(async () => {
        mockCreateIPXWebServer.mockImplementation(
          (await vi.importActual<typeof import('ipx')>('ipx')).createIPXWebServer,
        )
      })

      test('preserves original width if width param is not used', async () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          originServerAddress,
        })

        const url = new URL('/.netlify/images', originServerAddress)
        url.searchParams.set('url', LOCAL_IMAGE_PATH)

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(true)

        const { width } = await getImageResponseSize(response)

        expect(width).toBe(LOCAL_IMAGE_WIDTH)
      })

      test('resizes image to specified width preserving aspect ratio', async () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          originServerAddress,
        })

        const requestedWidth = 200

        const url = new URL('/.netlify/images', originServerAddress)
        url.searchParams.set('url', LOCAL_IMAGE_PATH)
        url.searchParams.set('w', requestedWidth.toString())

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(true)

        const { width, height } = await getImageResponseSize(response)

        expect(width).toBe(requestedWidth)
        expect(width / height).toBe(LOCAL_IMAGE_WIDTH / LOCAL_IMAGE_HEIGHT)
      })

      test('resizes image to specified height preserving aspect ratio', async () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          originServerAddress,
        })

        const requestedHeight = 200

        const url = new URL('/.netlify/images', originServerAddress)
        url.searchParams.set('url', LOCAL_IMAGE_PATH)
        url.searchParams.set('h', requestedHeight.toString())

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(true)

        const { width, height } = await getImageResponseSize(response)

        expect(height).toBe(requestedHeight)
        expect(width / height).toBe(LOCAL_IMAGE_WIDTH / LOCAL_IMAGE_HEIGHT)
      })

      test('resizes image to specified width and height ignoring original aspect ratio', async () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          originServerAddress,
        })

        const requestedWidth = 200
        const requestedHeight = 200

        const url = new URL('/.netlify/images', originServerAddress)
        url.searchParams.set('url', LOCAL_IMAGE_PATH)
        url.searchParams.set('w', requestedWidth.toString())
        url.searchParams.set('h', requestedHeight.toString())

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(true)

        const { width, height } = await getImageResponseSize(response)

        expect(width).toBe(requestedWidth)
        expect(height).toBe(requestedHeight)
        expect(width / height).not.toBe(LOCAL_IMAGE_WIDTH / LOCAL_IMAGE_HEIGHT)
      })
    })

    describe('remote images', () => {
      let remoteServerAddress: string
      let remoteServer: HTTPServer

      const IMAGE_WIDTH = 800
      const IMAGE_HEIGHT = 400

      beforeAll(async () => {
        remoteServer = new HTTPServer(
          createImageServerHandler(() => {
            return { width: IMAGE_WIDTH, height: IMAGE_HEIGHT }
          }),
        )

        remoteServerAddress = await remoteServer.start()
      })

      afterAll(async () => {
        await remoteServer.stop()
      })

      test('allow remote images matching configured patterns', async () => {
        mockCreateIPXWebServer.mockImplementation(
          (await vi.importActual<typeof import('ipx')>('ipx')).createIPXWebServer,
        )

        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          imagesConfig: {
            remote_images: [`^${remoteServerAddress}/.*`],
          },
        })

        const requestedWidth = 100

        const url = new URL('/.netlify/images', 'https://netlify.com')
        url.searchParams.set('url', remoteServerAddress)
        url.searchParams.set('w', requestedWidth.toString())

        const match = imageHandler.match(new Request(url))

        expect(match).toBeDefined()

        const response = await match!.handle()

        expect(response.ok).toBe(true)

        const { width, height } = await getImageResponseSize(response)

        expect(width).toBe(requestedWidth)
        expect(width / height).toBe(IMAGE_WIDTH / IMAGE_HEIGHT)
      }, 30_000)

      test('does not allow remote images not matching configured patterns', async () => {
        const imageHandler = new ImageHandler({
          logger: createMockLogger(),
          imagesConfig: {
            remote_images: [],
          },
        })

        const url = new URL('/.netlify/images', 'https://netlify.com')
        url.searchParams.set('url', remoteServerAddress)
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
