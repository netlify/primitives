import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { Fixture } from '@netlify/dev-utils'
import { describe, expect, test } from 'vitest'

import { isFile } from './lib/fs.js'
import { NetlifyDev } from './main.js'

import { withMockApi } from '../test/mock-api.js'

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
      const dev = new NetlifyDev({
        projectRoot: directory,
      })

      await dev.start()

      const res = await dev.handle(req)

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
      const dev = new NetlifyDev({
        projectRoot: directory,
      })

      await dev.start()

      const res = await dev.handle(req)

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
      const dev = new NetlifyDev({
        projectRoot: directory,
      })

      await dev.start()

      const res = await dev.handle(req)

      expect(await res?.text()).toBe('to.html')

      await fixture.destroy()
    })

    test('Invoking a function on a custom path', async () => {
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
      const dev = new NetlifyDev({
        projectRoot: directory,
      })

      await dev.start()

      const res = await dev.handle(req)

      expect(await res?.text()).toBe('Hello from function')

      await fixture.destroy()
    })

    test('Invoking a function on a custom path, shadowed by a static file', async () => {
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
      const dev = new NetlifyDev({
        projectRoot: directory,
      })

      await dev.start()

      const res = await dev.handle(req)

      expect(await res?.text()).toBe('hello.html')

      await fixture.destroy()
    })

    test('Rewrite to a function on a custom path', async () => {
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
      const dev = new NetlifyDev({
        projectRoot: directory,
      })

      await dev.start()

      const res = await dev.handle(req)

      expect(await res?.text()).toBe('Hello from function')

      await fixture.destroy()
    })

    test('Invoking a function that interacts with Blobs', async () => {
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
        .withFile(
          '.gitignore',
          `# Some comment
        dir1/
        !dir1/foo`,
        )
        .withPackages({
          '@netlify/blobs': '8.2.0',
        })
      const directory = await fixture.create()

      const gitIgnorePath = resolve(directory, '.gitignore')
      expect(await isFile(gitIgnorePath)).toBe(true)

      const gitIgnoresPre = (await readFile(gitIgnorePath, 'utf8')).split('\n').map((line) => line.trim())
      expect(gitIgnoresPre).toContain('# Some comment')
      expect(gitIgnoresPre).toContain('dir1/')
      expect(gitIgnoresPre).toContain('!dir1/foo')

      const req = new Request('https://site.netlify/hello')
      const dev = new NetlifyDev({
        projectRoot: directory,
      })

      await dev.start()

      const res = await dev.handle(req)

      expect(await res?.text()).toBe('Hello from blob')

      const gitIgnoresPost = (await readFile(gitIgnorePath, 'utf8')).split('\n').map((line) => line.trim())
      expect(gitIgnoresPost).toContain('# Some comment')
      expect(gitIgnoresPost).toContain('dir1/')
      expect(gitIgnoresPost).toContain('!dir1/foo')
      expect(gitIgnoresPost).toContain('# Local Netlify folder')
      expect(gitIgnoresPost).toContain('.netlify')

      await fixture.destroy()
    })

    test.skip('Invoking a function that interacts with the Cache API', async () => {
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
      const dev = new NetlifyDev({
        projectRoot: directory,
      })

      await dev.start()

      const res = await dev.handle(req)

      expect(await res?.text()).toBe('Hello world')

      await fixture.destroy()
    })
  })

  describe('With linked site', () => {
    const siteInfo = {
      id: 'site_id',
      name: 'site-name',
      account_slug: 'test-account',
      build_settings: { env: {} },
    }
    const routes = [
      { path: 'sites/site_id', response: siteInfo },
      { path: 'sites/site_id/service-instances', response: [] },
      {
        path: 'accounts',
        response: [{ slug: siteInfo.account_slug }],
      },
      {
        path: 'accounts/test-account/env',
        response: [
          {
            key: 'WITH_BRANCH_OVERRIDE',
            scopes: ['builds', 'functions', 'runtime'],
            values: [
              { context: 'branch-deploy' as const, value: 'value from branch-deploy context' },
              {
                context: 'branch' as const,
                context_parameter: 'feat/make-it-pop',
                value: 'value from branch context',
              },
              { context: 'dev' as const, value: 'value from dev context' },
              { context: 'production' as const, value: 'value from production context' },
              {
                context: 'deploy-preview' as const,
                context_parameter: '12345',
                value: 'value from deploy-preview context',
              },
              { context: 'all' as const, value: 'value from all context' },
            ],
          },
          {
            key: 'WITHOUT_OVERRIDE',
            scopes: ['builds', 'functions', 'runtime'],
            values: [
              { context: 'branch-deploy' as const, value: 'value from branch-deploy context' },
              { context: 'all' as const, value: 'value from all context' },
            ],
          },
        ],
      },
    ]

    test('Invoking a function', async () => {
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
          `export default async () => Response.json({
             WITH_BRANCH_OVERRIDE: Netlify.env.get("WITH_BRANCH_OVERRIDE"),
             WITHOUT_OVERRIDE: Netlify.env.get("WITHOUT_OVERRIDE")
           });
           
           export const config = { path: "/hello" };`,
        )
        .withStateFile({ siteId: 'site_id' })
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/hello')

      await withMockApi(routes, async (context) => {
        const dev = new NetlifyDev({
          apiURL: context.apiUrl,
          apiToken: 'token',
          projectRoot: directory,
        })

        await dev.start()

        const res = await dev.handle(req)

        expect(await res?.json()).toStrictEqual({
          WITH_BRANCH_OVERRIDE: 'value from dev context',
          WITHOUT_OVERRIDE: 'value from all context',
        })
      })

      await fixture.destroy()
    })
  })
})
