import type { AddressInfo } from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Fixture } from '@netlify/dev-utils'
import { beforeEach, describe, expect, test } from 'vitest'
import { createServer } from 'vite'

import netlify from './main.js'

const PLUGIN_PATH = path.resolve(fileURLToPath(import.meta.url), '../..')

const startTestServer = async (options: Parameters<typeof createServer>[0] = {}) => {
  const server = await createServer({
    logLevel: 'silent',
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

describe('Plugin constructor', () => {
  test('Is a no-op when running in the Netlify CLI', () => {
    process.env.NETLIFY_DEV = 'true'

    expect(netlify()).toEqual([])
  })
})

describe('configureServer', { timeout: 15_000 }, () => {
  const originalEnv = { ...process.env }
  beforeEach(() => {
    process.env = { ...originalEnv }
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
        vite: '6.0.0',
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

  describe('Middleware enabled', () => {
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
          vite: '6.0.0',
          '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
        })
        .create()

      const { server, url } = await startTestServer({
        root: directory,
      })

      const response = await fetch(url)
      expect(response).toHaveProperty('status', 200)
      expect(await response.text()).toContain('Hello from the static index.html file')

      expect(await fetch(`${url}/js/main.js`).then((r) => r.text())).toContain('console.log(')

      expect(await fetch(`${url}/contact/email.html`).then((r) => r.text())).toContain('Hello from another static file')

      // This is Vite's behavior in dev for "404s"
      const notFoundResponse = await fetch(`${url}/wp-admin.php`)
      expect(notFoundResponse).toHaveProperty('status', 200)
      expect(await notFoundResponse.text()).toContain('Hello from the static index.html file')

      await server.close()
      await fixture.destroy()
    })

    test('Returns static files with configured Netlify headers', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[[headers]]
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
          vite: '6.0.0',
          '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
        })
        .create()

      const { server, url } = await startTestServer({
        root: directory,
      })

      expect((await fetch(`${url}/contact/email`)).headers.get('X-NF-Hello')).toBe('world')
      expect((await fetch(url)).headers.get('X-NF-Hello')).toBe('world')
      expect((await fetch(`${url}/contact/email`)).headers.get('X-Contact-Type')).toBe('email')
      expect((await fetch(url)).headers.get('X-Contact-Type')).toBeNull()

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
          vite: '6.0.0',
          '@netlify/vite-plugin': pathToFileURL(path.resolve(directory, PLUGIN_PATH)).toString(),
        })
        .create()

      const { server, url } = await startTestServer({
        root: directory,
      })

      expect(await fetch(`${url}/contact/email`).then((r) => r.text())).toContain('Hello from the redirect target')
      expect(await fetch(`${url}/contact/e-mail`, { redirect: 'follow' }).then((r) => r.text())).toContain(
        'Hello from the redirect target',
      )
      expect(await fetch(`${url}/beta/pricing`).then((r) => r.text())).toContain('Hello from the rewrite target')

      await server.close()
      await fixture.destroy()
    })
  })
})
