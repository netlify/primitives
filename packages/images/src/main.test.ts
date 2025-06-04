import http from 'node:http'

import { createMockLogger } from '@netlify/dev-utils'
import { imageSize } from 'image-size'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { createIPXWebServer } from 'ipx'
import { generateImage } from 'js-image-generator'

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
      let originServer: http.Server
      let originServerAddress: string
      const LOCAL_IMAGE_PATH = '/local/image.jpg'
      const LOCAL_IMAGE_WIDTH = 800
      const LOCAL_IMAGE_HEIGHT = 400

      beforeAll(async () => {
        ;[originServer, originServerAddress] = await new Promise<[http.Server, string]>((resolve, reject) => {
          const originServer = http.createServer(function originHandler(req, res) {
            if (req.url !== LOCAL_IMAGE_PATH) {
              res.writeHead(404, { 'Content-Type': 'text/plain' })
              res.end('Not Found')
              return
            }

            generateImage(LOCAL_IMAGE_WIDTH, LOCAL_IMAGE_HEIGHT, 50, (err, imageData) => {
              if (err) {
                console.error('Error generating image:', err)
                res.writeHead(500, { 'Content-Type': 'text/plain' })
                res.end('Internal Server Error')
                return
              }

              res.writeHead(200, { 'Content-Type': 'image/jpeg' })

              res.end(imageData.data)
            })
          })
          originServer.listen(() => {
            const address = originServer.address()

            if (!address || typeof address === 'string') {
              reject(new Error('Server cannot be started on a pipe or Unix socket'))
              return
            }

            resolve([originServer, `http://localhost:${address.port.toString()}`])
          })
        })
      })

      afterAll(() => {
        originServer.close()
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

        const { width } = imageSize(new Uint8Array(await response.arrayBuffer()))

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

        const { width, height } = imageSize(new Uint8Array(await response.arrayBuffer()))

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

        const { width, height } = imageSize(new Uint8Array(await response.arrayBuffer()))

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

        const { width, height } = imageSize(new Uint8Array(await response.arrayBuffer()))

        expect(width).toBe(requestedWidth)
        expect(height).toBe(requestedHeight)
        expect(width / height).not.toBe(LOCAL_IMAGE_WIDTH / LOCAL_IMAGE_HEIGHT)
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
