import { Fixture } from '@netlify/dev-utils'
import { describe, expect, test } from 'vitest'

import { handle } from './main.js'

describe('Handling requests', () => {
  describe('No linked site', () => {
    test('Same-site rewrite to a static file', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
        publish = "public"
        `,
        )
        .withFile('public/_redirects', `/from  /to  200`)
        .withFile('public/to.html', `to.html`)
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/from')
      const res = await handle(req, {
        projectRoot: directory,
      })

      expect(await res?.text()).toBe('to.html')

      await fixture.destroy()
    })

    test('Same-site rewrite to a static file (shadowed)', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
        publish = "public"
        `,
        )
        .withFile('public/_redirects', `/from  /to  200`)
        .withFile('public/from.html', `from.html`)
        .withFile('public/to.html', `to.html`)
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/from')
      const res = await handle(req, {
        projectRoot: directory,
      })

      expect(await res?.text()).toBe('from.html')

      await fixture.destroy()
    })

    test('Same-site rewrite to a static file (forced)', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
        publish = "public"
        `,
        )
        .withFile('public/_redirects', `/from  /to  200!`)
        .withFile('public/from.html', `from.html`)
        .withFile('public/to.html', `to.html`)
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/from')
      const res = await handle(req, {
        projectRoot: directory,
      })

      expect(await res?.text()).toBe('to.html')

      await fixture.destroy()
    })

    test('Function', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
        publish = "public"
        `,
        )
        .withFile('public/hello.html', `hello.html`)
        .withFile(
          'netlify/functions/hello.mjs',
          `export default async () => new Response("Hello from function"); export const config = { path: "/hello" };`,
        )
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/hello')
      const res = await handle(req, {
        projectRoot: directory,
      })

      expect(await res?.text()).toBe('Hello from function')

      await fixture.destroy()
    })

    test('Function (shadowed)', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
        publish = "public"
        `,
        )
        .withFile('public/hello.html', `hello.html`)
        .withFile(
          'netlify/functions/hello.mjs',
          `export default async () => new Response("Hello from function"); export const config = { path: "/hello", preferStatic: true };`,
        )
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/hello')
      const res = await handle(req, {
        projectRoot: directory,
      })

      expect(await res?.text()).toBe('hello.html')

      await fixture.destroy()
    })

    test('Rewrite to function', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
        publish = "public"
        `,
        )
        .withFile('public/_redirects', `/from  /hello  200!`)
        .withFile('public/hello.html', `hello.html`)
        .withFile(
          'netlify/functions/hello.mjs',
          `export default async () => new Response("Hello from function"); export const config = { path: "/hello" };`,
        )
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/from')
      const res = await handle(req, {
        projectRoot: directory,
      })

      expect(await res?.text()).toBe('Hello from function')

      await fixture.destroy()
    })

    test('Function with Blobs', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
        publish = "public"
        `,
        )
        .withFile(
          'netlify/functions/hello.mjs',
          `import { getStore } from "@netlify/blobs";
          export default async () => {
            const store = getStore("my-store");

            await store.set("my-key", "Hello from blob");

            const value = await store.get("my-key");

            return new Response(value);
          };
          export const config = { path: "/hello" };`,
        )
        .withPackages({
          '@netlify/blobs': '8.2.0',
        })
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/hello')
      const res = await handle(req, {
        projectRoot: directory,
      })

      expect(await res?.text()).toBe('Hello from blob')

      await fixture.destroy()
    })

    test.skip('Function with Cache API', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
        publish = "public"
        `,
        )
        .withFile(
          'netlify/functions/hello.mjs',
          `export default async () => {
            const cache = await caches.open("my-cache");
            
            await cache.put("https://example.com", new Response("Cached response"));

            return new Response("Hello world");
          };
          export const config = { path: "/hello" };`,
        )
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/hello')
      const res = await handle(req, {
        projectRoot: directory,
      })

      expect(await res?.text()).toBe('Hello world')

      await fixture.destroy()
    })
  })
})
