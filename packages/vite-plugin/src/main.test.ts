import type { AddressInfo } from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { createImageServerHandler, Fixture, generateImage, HTTPServer } from '@netlify/dev-utils'
import { type Browser, type ConsoleMessage, type Locator, type Page, chromium } from 'playwright'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createServer } from 'vite'

import netlify from './main.js'

const PLUGIN_PATH = path.resolve(fileURLToPath(import.meta.url), '../..')

const startTestServer = async (options: Parameters<typeof createServer>[0] = {}) => {
  const server = await createServer({
    logLevel: 'warn',
    ...options,
  })

  await server.listen()

  // Wait until the server is actually listening
  const address = await new Promise<AddressInfo | string | null>((resolve, reject) => {
    const { httpServer } = server
    if (!httpServer) {
      reject(new Error('No httpServer'))
      return
    }

    if (httpServer.listening) {
      resolve(httpServer.address())
      return
    }

    httpServer.once('listening', () => {
      resolve(httpServer.address())
    })
    httpServer.once('error', reject)
  })

  const port = typeof address === 'object' && address ? address.port : 5173
  return { server, url: `http://localhost:${port.toString()}` }
}

const createMockViteLogger = () => {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    warnOnce: vi.fn(),
    error: vi.fn(),
    clearScreen: vi.fn(),
    hasErrorLogged: vi.fn(),
    hasWarned: false,
  }
}

const originalEnv = { ...process.env }
beforeEach(() => {
  process.env = { ...originalEnv }
})

describe.for([['5.0.0'], ['6.0.0'], ['7.0.0']])('Vite %s', ([viteVersion]) => {
  describe('Plugin constructor', () => {
    test('Is a no-op when running in the Netlify CLI', () => {
      process.env.NETLIFY_DEV = 'true'

      expect(netlify()).toEqual([])
    })
  })

  describe('configureServer', { timeout: 15_000 }, () => {
    test('does not warn on single plugin instance', async () => {
      const mockLogger = createMockViteLogger()
      const { server } = await startTestServer({
        customLogger: mockLogger,
        plugins: [netlify({ middleware: false })],
      })

      expect(mockLogger.warn).not.toHaveBeenCalled()

      await server.close()
    })

    test('warns on duplicate plugin instances', async () => {
      const mockLogger = createMockViteLogger()
      const { server } = await startTestServer({
        customLogger: mockLogger,
        plugins: [netlify({ middleware: false }), netlify({ middleware: false })],
      })

      expect(mockLogger.warn).toHaveBeenCalledOnce()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/Multiple instances of @netlify\/vite-plugin have been loaded/),
        expect.objectContaining({}),
      )

      await server.close()
    })

    test('does not warn about duplicate plugin instances when server restarts', async () => {
      const mockLogger = createMockViteLogger()

      const firstServer = await startTestServer({
        customLogger: mockLogger,
        plugins: [netlify({ middleware: false })],
      })
      expect(mockLogger.warn).not.toHaveBeenCalled()
      await firstServer.server.close()

      const secondServer = await startTestServer({
        customLogger: mockLogger,
        plugins: [netlify({ middleware: false })],
      })
      expect(mockLogger.warn).not.toHaveBeenCalled()

      await secondServer.server.close()
    })

    test('Populates Netlify runtime environment (globals and env vars)', async () => {
      const fixture = new Fixture()
        .withFile(
          'vite.config.js',
          `import { defineConfig } from 'vite';
           import netlify from '@netlify/vite-plugin';

           export default defineConfig({
             plugins: [
               netlify({ middleware: false })
             ]
           });`,
        )
        .withFile(
          'index.html',
          `<!DOCTYPE html>
           <html>
             <head><title>Hello World</title></head>
             <body><h1>Hello from the browser</h1></body>
           </html>`,
        )
      const directory = await fixture.create()
      await fixture
        .withPackages({
          vite: viteVersion,
          '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
        })
        .create()

      const { server } = await startTestServer({
        root: directory,
      })

      expect((globalThis as Record<string, unknown>).Netlify).toBeInstanceOf(Object)
      expect(process.env).toHaveProperty('NETLIFY_LOCAL', 'true')
      expect(process.env).toHaveProperty('CONTEXT', 'dev')

      await server.close()
      await fixture.destroy()
    })

    test('Prints a basic message on server start', async () => {
      const fixture = new Fixture()
        .withFile(
          'vite.config.js',
          `import { defineConfig } from 'vite';
           import netlify from '@netlify/vite-plugin';

           export default defineConfig({
             plugins: [
               netlify({ middleware: false })
             ]
           });`,
        )
        .withFile(
          'index.html',
          `<!DOCTYPE html>
             <html>
               <head><title>Hello World</title></head>
               <body><h1>Hello from the browser</h1></body>
             </html>`,
        )
      const directory = await fixture.create()
      await fixture
        .withPackages({
          vite: viteVersion,
          '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
        })
        .create()

      const mockLogger = createMockViteLogger()
      const { server } = await startTestServer({
        root: directory,
        logLevel: 'info',
        customLogger: mockLogger,
      })

      expect(mockLogger.error).not.toHaveBeenCalled()
      expect(mockLogger.warn).not.toHaveBeenCalled()
      expect(mockLogger.warnOnce).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenNthCalledWith(1, 'Environment loaded', expect.objectContaining({}))
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        '💭 Linking this project to a Netlify site lets you deploy your site, use any environment variables \
defined on your team and site and much more. Run npx netlify init to get started.',
        expect.objectContaining({}),
      )

      await server.close()
      await fixture.destroy()
    })

    test('Prints a message listing emulated features on server start', async () => {
      const fixture = new Fixture()
        .withFile(
          'vite.config.js',
          `import { defineConfig } from 'vite';
           import netlify from '@netlify/vite-plugin';
           export default defineConfig({
             plugins: [
               netlify({
                middleware: true,
                edgeFunctions: { enabled: false },
              })
             ]
           });`,
        )
        .withFile(
          'index.html',
          `<!doctype html>
           <html>
             <head><title>Hello World</title></head>
             <body><h1>Hello from the browser</h1></body>
           </html>`,
        )
      const directory = await fixture.create()
      await fixture
        .withPackages({
          vite: viteVersion,
          '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
        })
        .create()

      const mockLogger = createMockViteLogger()
      const { server } = await startTestServer({
        root: directory,
        logLevel: 'info',
        customLogger: mockLogger,
      })

      expect(mockLogger.error).not.toHaveBeenCalled()
      expect(mockLogger.warn).not.toHaveBeenCalled()
      expect(mockLogger.warnOnce).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledTimes(3)
      expect(mockLogger.info).toHaveBeenNthCalledWith(1, 'Environment loaded', expect.objectContaining({}))
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        2,
        'Middleware loaded. Emulating features: blobs, environmentVariables, functions, geolocation, headers, images, redirects, static.',
        expect.objectContaining({}),
      )
      expect(mockLogger.info).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('Linking this project to a Netlify site'),
        expect.objectContaining({}),
      )

      await server.close()
      await fixture.destroy()
    })

    describe('Middleware enabled', () => {
      let browser: Browser
      let page: Page

      beforeEach(async () => {
        browser = await chromium.launch()
        page = await browser.newPage()
      })

      afterEach(async () => {
        await browser.close()
      })

      test('Returns static files from project dir', async () => {
        const fixture = new Fixture()
          .withFile(
            'vite.config.js',
            `import { defineConfig } from 'vite';
             import netlify from '@netlify/vite-plugin';

             export default defineConfig({
               plugins: [
                 netlify({
                   middleware: true
                 })
               ]
             });`,
          )
          .withFile(
            'index.html',
            `<!doctype html>
             <html>
               <head><title>Hello World</title></head>
               <body>Hello from the static index.html file</body>
               <script type="module" src="/js/main.js"></script>
             </html>`,
          )
          .withFile(
            'contact/email.html',
            `<!doctype html>
             <html>
               <head><title>Contact us via email</title></head>
               <body>Hello from another static file</body>
             </html>`,
          )
          .withFile('js/main.js', `console.log('Hello from the browser')`)
        const directory = await fixture.create()
        await fixture
          .withPackages({
            vite: viteVersion,
            '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
          })
          .create()

        const { server, url } = await startTestServer({
          root: directory,
        })

        const response = await page.goto(url)
        expect(response?.status()).toBe(200)
        expect(await response?.text()).toContain('Hello from the static index.html file')

        expect(await page.goto(`${url}/js/main.js`).then((r) => r?.text())).toContain('console.log(')

        expect(await page.goto(`${url}/contact/email.html`).then((r) => r?.text())).toContain(
          'Hello from another static file',
        )

        // This is Vite's behavior in dev for "404s"
        const notFoundResponse = await page.goto(`${url}/wp-admin.php`)
        expect(notFoundResponse?.status()).toBe(200)
        expect(await notFoundResponse?.text()).toContain('Hello from the static index.html file')

        await server.close()
        await fixture.destroy()
      })

      test('Returns static files with configured Netlify headers', async () => {
        const fixture = new Fixture()
          .withFile(
            'netlify.toml',
            `[build]
             publish = "dist"
             [[headers]]
             for = "/contact/*"
             [headers.values]
             "X-Contact-Type" = "email"
             [[headers]]
             for = "/*"
             [headers.values]
             "X-NF-Hello" = "world"`,
          )
          .withFile(
            'vite.config.js',
            `import { defineConfig } from 'vite';
             import netlify from '@netlify/vite-plugin';

             export default defineConfig({
               plugins: [
                 netlify({
                   middleware: true
                 })
               ]
             });`,
          )
          .withFile(
            'index.html',
            `<!doctype html>
             <html>
               <head><title>Hello World</title></head>
               <body>Hello from the static index.html file</body>
             </html>`,
          )
          .withFile(
            'contact/email.html',
            `<!doctype html>
             <html>
               <head><title>Contact us via email</title></head>
               <body>Hello from another static file</body>
             </html>`,
          )
        const directory = await fixture.create()
        await fixture
          .withPackages({
            vite: viteVersion,
            '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
          })
          .create()

        const { server, url } = await startTestServer({
          root: directory,
        })

        expect(await page.goto(`${url}/contact/email`).then((r) => r?.headers())).toHaveProperty('x-nf-hello', 'world')
        expect(await page.goto(url).then((r) => r?.headers())).toHaveProperty('x-nf-hello', 'world')
        expect(await page.goto(`${url}/contact/email`).then((r) => r?.headers())).toHaveProperty(
          'x-contact-type',
          'email',
        )
        expect(await page.goto(url).then((r) => r?.headers())).not.toHaveProperty('x-contact-type')

        await server.close()
        await fixture.destroy()
      })

      test('Respects configured Netlify redirects and rewrites', async () => {
        const fixture = new Fixture()
          .withFile(
            'netlify.toml',
            `[[redirects]]
              status = 301
              from = "/contact/e-mail"
              to = "/contact/email"
              [[redirects]]
              status = 200
              from = "/beta/*"
              to = "/nextgenv3/:splat"`,
          )
          .withFile(
            'vite.config.js',
            `import { defineConfig } from 'vite';
             import netlify from '@netlify/vite-plugin';

             export default defineConfig({
               plugins: [
                 netlify({
                   middleware: true
                 })
               ]
             });`,
          )
          .withFile(
            'contact/email.html',
            `<!doctype html>
             <html>
               <head><title>Contact us via email</title></head>
               <body>Hello from the redirect target</body>
             </html>`,
          )
          .withFile(
            'nextgenv3/pricing.html',
            `<!doctype html>
             <html>
               <head><title>Pricing</title></head>
               <body>Hello from the rewrite target</body>
             </html>`,
          )
        const directory = await fixture.create()
        await fixture
          .withPackages({
            vite: viteVersion,
            '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
          })
          .create()

        const { server, url } = await startTestServer({
          root: directory,
        })

        expect(await page.goto(`${url}/contact/email`).then((r) => r?.text())).toContain(
          'Hello from the redirect target',
        )
        expect(await page.goto(`${url}/contact/e-mail`).then((r) => r?.text())).toContain(
          'Hello from the redirect target',
        )
        expect(await page.goto(`${url}/beta/pricing`).then((r) => r?.text())).toContain('Hello from the rewrite target')

        await server.close()
        await fixture.destroy()
      })

      test('Handles Image CDN requests', async () => {
        const IMAGE_WIDTH = 800
        const IMAGE_HEIGHT = 400

        const remoteServer = new HTTPServer(
          createImageServerHandler(() => {
            return { width: IMAGE_WIDTH, height: IMAGE_HEIGHT }
          }),
        )

        const remoteServerAddress = await remoteServer.start()

        const fixture = new Fixture()
          .withFile(
            'netlify.toml',
            `[images]
             remote_images = [
               "^${remoteServerAddress}/allowed/.*"
             ]`,
          )
          .withFile(
            'vite.config.js',
            `import { defineConfig } from 'vite';
             import netlify from '@netlify/vite-plugin';

             export default defineConfig({
               plugins: [
                 netlify({
                   middleware: true,
                 })
               ]
             });`,
          )
          .withFile(
            'index.html',
            `<!DOCTYPE html>
             <html>
               <head><title>Hello World</title></head>
               <body>
                 <h1>Hello from the browser</h1>
                 <img id="local-image" src="/.netlify/images?url=${encodeURIComponent('local/image.jpg')}&w=100" />
                 <img id="allowed-remote-image" src="/.netlify/images?url=${encodeURIComponent(`${remoteServerAddress}/allowed/image`)}&w=100" />
                 <img id="not-allowed-remote-image" src="/.netlify/images?url=${encodeURIComponent(`${remoteServerAddress}/not-allowed/image`)}&w=100" />
               </body>
             </html>`,
          )
          .withFile('local/image.jpg', await generateImage(IMAGE_WIDTH, IMAGE_HEIGHT))

        const directory = await fixture.create()
        await fixture
          .withPackages({
            vite: viteVersion,
            '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
          })
          .create()

        const mockLogger = createMockViteLogger()
        const { server, url } = await startTestServer({
          root: directory,
          logLevel: 'info',
          customLogger: mockLogger,
        })

        await page.goto(url)

        const getImageSize = (locator: Locator) => {
          return locator.evaluate((img: HTMLImageElement) => {
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
              throw new Error(`Image was not loaded`)
            }

            return {
              width: img.naturalWidth,
              height: img.naturalHeight,
            }
          })
        }

        expect(await getImageSize(page.locator('#local-image'))).toEqual({ width: 100, height: 50 })
        expect(await getImageSize(page.locator('#allowed-remote-image'))).toEqual({ width: 100, height: 50 })

        await expect(
          async () => await getImageSize(page.locator('#not-allowed-remote-image')),
          'Not allowed remote image should not load',
        ).rejects.toThrowError(`Image was not loaded`)

        await server.close()
        await fixture.destroy()
      })

      // TODO: Figure out why Blobs is not available in these tests. It works
      // when I test manually on a site.
      test.todo('Handles function requests', async () => {
        const fixture = new Fixture()
          .withFile(
            'vite.config.js',
            `import { defineConfig } from 'vite';
             import netlify from '@netlify/vite-plugin';

             export default defineConfig({
               plugins: [
                 netlify({
                   middleware: true,
                 })
               ]
             });`,
          )
          .withFile(
            'index.html',
            `<!DOCTYPE html>
             <html>
               <head><title>Hello World</title></head>
               <body>
                 <h1>Hello from the browser</h1>
               </body>
             </html>`,
          )
          .withFile(
            'netlify/functions/blob.mjs',
            `
            import { getStore } from "@netlify/blobs"


            export default async (req, context) => {
              const store = getStore("my-store")

              const entry = await store.get("key")
              if (!entry) {
                await store.set("key", "Blob the builder")

                return new Response("Added")
              }

              return new Response(entry)
            }

            export const config = {
              path: "/blob"
            }
          `,
          )

        const directory = await fixture.create()
        await fixture
          .withPackages({
            vite: viteVersion,
            '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
            '@netlify/blobs': pathToFileURL(path.resolve(directory, PLUGIN_PATH, '../blobs')).toString(),
          })
          .create()

        const mockLogger = createMockViteLogger()
        const { server, url } = await startTestServer({
          root: directory,
          logLevel: 'info',
          customLogger: mockLogger,
        })

        expect(await page.goto(`${url}/blob`).then((r) => r?.text())).toContain('Added')
        expect(await page.goto(`${url}/blob`).then((r) => r?.text())).toContain('Blob the builder')

        await server.close()
        await fixture.destroy()
      })

      test('Handles edge function requests', async () => {
        const fixture = new Fixture()
          .withFile(
            'vite.config.js',
            `import { defineConfig } from 'vite';
             import netlify from '@netlify/vite-plugin';

             export default defineConfig({
               plugins: [
                 netlify({
                   middleware: true,
                 })
               ]
             });`,
          )
          .withFile(
            'index.html',
            `<!DOCTYPE html>
             <html>
               <head><title>Hello World</title></head>
               <body>
                 <h1>Hello from the browser</h1>
               </body>
             </html>`,
          )
          .withFile(
            'netlify/edge-functions/yell.mjs',
            `
            export default async (req, context) => {
              const res = await context.next()
              const text = await res.text()

              return new Response(text.toUpperCase(), res)
            }

            export const config = {
              path: "/*"
            }
          `,
          )

        const directory = await fixture.create()
        await fixture
          .withPackages({
            vite: viteVersion,
            '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
          })
          .create()

        const mockLogger = createMockViteLogger()
        const { server, url } = await startTestServer({
          root: directory,
          logLevel: 'info',
          customLogger: mockLogger,
        })

        expect(await page.goto(url).then((r) => r?.text())).toContain('<H1>HELLO FROM THE BROWSER</H1>')

        await server.close()
        await fixture.destroy()
      })

      test('Ignores SPA redirect in dev mode', async () => {
        const fixture = new Fixture()
          .withFile(
            'netlify.toml',
            `[[redirects]]
              from = "/*"
              to = "/index.html"
              status = 200`,
          )
          .withFile(
            'vite.config.js',
            `import { defineConfig } from 'vite';
             import netlify from '@netlify/vite-plugin';

             export default defineConfig({
               plugins: [
                 netlify({
                   middleware: true,
                 })
               ]
             });`,
          )
          .withFile(
            'index.html',
            `<!DOCTYPE html>
             <html>
               <head><title>SPA App</title></head>
               <body>
                 <div id="app"></div>
                 <script type="module" src="/src/main.js"></script>
               </body>
             </html>`,
          )
          .withFile('src/main.js', `document.getElementById('app').textContent = 'Hello from SPA'`)
        const directory = await fixture.create()
        await fixture
          .withPackages({
            vite: viteVersion,
            '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
          })
          .create()

        const { server, url } = await startTestServer({
          root: directory,
        })

        // Any route should render the root index.html (Vite handles it) and JS should execute (which
        // verifies the SPA redirect isn't interfering with loading the .js module).
        await page.goto(`${url}/some-route`)
        await page.waitForSelector('#app')
        expect(await page.textContent('#app')).toBe('Hello from SPA')

        // Client-side navigation should also work (Vite handles it)
        await page.goto(`${url}/some-other-route`)
        await page.waitForSelector('#app')
        expect(await page.textContent('#app')).toBe('Hello from SPA')

        await server.close()
        await fixture.destroy()
      })
    })

    describe('With @vitejs/plugin-react', () => {
      // TODO(serhalp): Skipping on Windows for now. There's an issue on the GitHub Actions
      // Windows image with resolving the `src/main.jsx` path for some reason.
      test.skipIf(process.platform === 'win32')('Returns static files with configured Netlify headers', async () => {
        const fixture = new Fixture()
          .withFile(
            'vite.config.js',
            `import { defineConfig } from 'vite';
             import netlify from '@netlify/vite-plugin';
             import react from '@vitejs/plugin-react';

             export default defineConfig({
               plugins: [
                 netlify({
                   middleware: true
                 }),
                 react(),
               ]
             });`,
          )
          .withFile(
            'netlify.toml',
            `[[headers]]
             for = "/"
             [headers.values]
             "X-NF-Hello" = "world"`,
          )
          .withFile(
            'index.html',
            `<!doctype html>
             <html lang="en">
               <head>
                 <meta charset="UTF-8" />
                 <title>Hello from SSR</title>
               </head>
               <body>
                 <div id="root"></div>
                 <script type="module" src="/src/main.jsx"></script>
               </body>
             </html>`,
          )
          .withFile(
            'src/main.jsx',
            `import { StrictMode } from 'react'
             import { createRoot } from 'react-dom/client'
             import App from './App.jsx'
             import './index.css'

             createRoot(document.getElementById('root')).render(
               <StrictMode>
                <App />
              </StrictMode>,
            )`,
          )
          .withFile('src/index.css', 'body { color: red }')
          .withFile(
            'src/App.jsx',
            `import reactLogo from './assets/react.svg'

             export default () =>
               <header>
                 <h1>Hello from CSR</h1>
                 <img src={reactLogo} />
               </header>`,
          )
          .withFile(
            'src/assets/react.svg',
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>',
          )
        const directory = await fixture.create()
        await fixture
          .withPackages({
            '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
            '@vitejs/plugin-react': '4.6.0',
            react: '19.1.0',
            'react-dom': '19.1.0',
            vite: viteVersion,
          })
          .create()

        const { server, url } = await startTestServer({
          root: directory,
        })

        const browser = await chromium.launch()
        const page = await browser.newPage()
        const browserErrorLogs: ConsoleMessage[] = []
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            browserErrorLogs.push(msg)
          }
        })

        const response = await page.goto(url)
        expect(response?.status()).toBe(200)
        expect(await response?.text()).toContain('Hello from SSR')
        expect(response?.headers()).toHaveProperty('x-nf-hello', 'world')
        expect(await page.innerHTML('html')).toContain('Hello from CSR')

        // React SPA mode serves index.html for unknown routes
        const notFoundResponse = await page.goto(`${url}/wp-admin.php`)
        expect(notFoundResponse?.status()).toBe(200)
        expect(await notFoundResponse?.text()).toContain('Hello from SSR')
        expect(await page.innerHTML('html')).toContain('Hello from CSR')

        expect(
          browserErrorLogs,
          `Unexpected error logs in browser: ${JSON.stringify(browserErrorLogs, null, 2)}`,
        ).toHaveLength(0)

        await server.close()
        await fixture.destroy()
        await browser.close()
      })
    })
  })
})
