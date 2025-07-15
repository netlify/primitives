import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createImageServerHandler, Fixture, generateImage, getImageResponseSize, HTTPServer } from '@netlify/dev-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { isFile } from './lib/fs.js'
import { NetlifyDev } from './main.js'

import { withMockApi } from '../test/mock-api.js'

describe('Handling requests', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })

      await dev.start()

      const res = await dev.handle(req)

      await dev.stop()

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
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })

      await dev.start()

      const res = await dev.handle(req)

      await dev.stop()

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
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })

      await dev.start()

      const res = await dev.handle(req)

      await dev.stop()

      expect(await res?.text()).toBe('to.html')

      await fixture.destroy()
    })

    test('Headers rules matching a static file are applied', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
           publish = "public"
           [[headers]]
           for = "/hello.txt"
           [headers.values]
           "Vary" = "User-Agent"
           `,
        )
        .withHeadersFile({
          pathPrefix: 'public',
          headers: [{ path: '/hello.txt', headers: ['Cache-Control: max-age=42'] }],
        })
        .withFile('public/hello.txt', 'Hello from hello.txt')
        .withFile('public/another-path.txt', 'Hello from another-path.txt')
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/hello.txt')
      const dev = new NetlifyDev({
        projectRoot: directory,
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })
      await dev.start()

      const matchRes = await dev.handle(req)

      await dev.stop()

      expect(await matchRes?.text()).toBe('Hello from hello.txt')
      expect(Object.fromEntries(matchRes?.headers.entries() ?? [])).toMatchObject({
        'cache-control': 'max-age=42',
        vary: 'User-Agent',
      })

      const noMatchRes = await dev.handle(new Request('https://site.netlify/another-path.txt'))
      expect(await noMatchRes?.text()).toBe('Hello from another-path.txt')
      expect(Object.fromEntries(noMatchRes?.headers.entries() ?? [])).not.toMatchObject({
        'cache-control': 'max-age=42',
        vary: 'User-Agent',
      })

      await fixture.destroy()
    })

    test('Headers rules matching target of a rewrite to a static file are applied', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
           publish = "public"
           [[headers]]
           for = "/from"
           [headers.values]
           "X-Custom" = "value for from rule"
           "X-Custom-From" = "another value for from rule"
           [[headers]]
           for = "/to.txt"
           [headers.values]
           "X-Custom" = "value for to rule"
           `,
        )
        .withFile('public/_redirects', `/from  /to.txt  200`)
        .withFile('public/to.txt', `to.txt content`)
      const directory = await fixture.create()
      const dev = new NetlifyDev({
        projectRoot: directory,
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })
      await dev.start()

      const directRes = await dev.handle(new Request('https://site.netlify/to.txt'))
      expect(await directRes?.text()).toBe('to.txt content')
      expect(directRes?.headers.get('X-Custom')).toBe('value for to rule')
      expect(directRes?.headers.get('X-Custom-From')).toBeNull()

      const rewriteRes = await dev.handle(new Request('https://site.netlify/from'))
      expect(await rewriteRes?.text()).toBe('to.txt content')
      expect(rewriteRes?.headers.get('X-Custom')).toBe('value for to rule')
      expect(rewriteRes?.headers.get('X-Custom-From')).toBeNull()

      await dev.stop()
      await fixture.destroy()
    })

    test('Headers rules matching a static file that shadows a function are applied', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
           publish = "public"
           [[headers]]
           for = "/shadowed-path.html"
           [headers.values]
           "X-Custom-Header" = "custom-value"
           `,
        )
        .withFile('public/shadowed-path.html', 'Hello from the static file')
        .withFile(
          'netlify/functions/shadowed-path.mjs',
          `export default async () => new Response("Hello from the function");
           export const config = { path: "/shadowed-path.html", preferStatic: true };
          `,
        )
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/shadowed-path.html')
      const dev = new NetlifyDev({
        projectRoot: directory,
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })
      await dev.start()

      const res = await dev.handle(req)
      expect(await res?.text()).toBe('Hello from the static file')
      expect(Object.fromEntries(res?.headers.entries() ?? [])).toMatchObject({
        'x-custom-header': 'custom-value',
      })

      await dev.stop()
      await fixture.destroy()
    })

    test('Headers rules matching an unshadowed function on a custom path are not applied', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
           publish = "public"
           [[headers]]
           for = "/hello.html"
           [headers.values]
           "X-Custom-Header" = "custom-value"
           `,
        )
        .withFile('public/hello.html', 'Hello from the static file')
        .withFile(
          'netlify/functions/hello.mjs',
          `export default async () => new Response("Hello from the function");
           export const config = { path: "/hello.html" };
          `,
        )
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/hello.html')
      const dev = new NetlifyDev({
        projectRoot: directory,
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })
      await dev.start()

      const res = await dev.handle(req)
      expect(await res?.text()).toBe('Hello from the function')
      expect(res?.headers.get('x-custom-header')).toBeNull()

      await dev.stop()
      await fixture.destroy()
    })

    // TODO(FRB-1834): Implement this test when edge functions are supported
    test.todo('Headers rules matching a path are not applied to edge function responses')

    test('Invoking a function, updating its contents and invoking it again', async () => {
      let fixture = new Fixture()
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
      const req = new Request('https://site.netlify/hello?param1=value1')
      const dev = new NetlifyDev({
        projectRoot: directory,
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })

      await dev.start()

      const res1 = await dev.handle(req)

      expect(await res1?.text()).toBe('Hello from function')

      fixture = fixture.withFile(
        'netlify/functions/hello.mjs',
        `export default async () => new Response("A new hello from function"); export const config = { path: "/hello" };`,
      )

      await fixture.create()

      const res2 = await dev.handle(req)

      expect(await res2?.text()).toBe('A new hello from function')

      await dev.stop()
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
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })

      await dev.start()

      const res = await dev.handle(req)

      expect(await res?.text()).toBe('hello.html')

      await dev.stop()
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
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })

      await dev.start()

      const res = await dev.handle(req)

      expect(await res?.text()).toBe('Hello from function')

      await dev.stop()
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
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
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

      await dev.stop()
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
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })

      await dev.start()

      const res = await dev.handle(req)

      expect(await res?.text()).toBe('Hello world')

      await dev.stop()
      await fixture.destroy()
    })

    test('Image CDN requests are supported', async () => {
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
            ]

          [[redirects]]
            from = "/image-cdn-rewrite"
            to = "/.netlify/images?url=:url&w=:width"
            status = 200

          [redirects.query]
            url = ":url"
            w = ":width"`,
        )
        .withFile('local/image.jpg', await generateImage(IMAGE_WIDTH, IMAGE_HEIGHT))

      const directory = await fixture.create()

      const dev = new NetlifyDev({
        projectRoot: directory,
        edgeFunctions: {
          // disable edge functions to avoid relying on edge functions handling spinning up internal server
          // for local images
          enabled: false,
        },
        images: {
          remoteURLPatterns: [`^${remoteServerAddress}/allowed-via-option/.*`],
        },
      })

      await dev.start()

      const localImageRequest = new Request(
        `https://site.netlify/.netlify/images?url=${encodeURIComponent('local/image.jpg')}&w=100`,
      )
      const localImageResponse = await dev.handle(localImageRequest)
      expect(localImageResponse?.ok).toBe(true)
      expect(localImageResponse?.headers.get('content-type')).toMatch(/^image\//)
      expect(await getImageResponseSize(localImageResponse ?? new Response('No @netlify/dev response'))).toMatchObject({
        width: 100,
        height: 50,
      })

      const allowedRemoteImageRequest = new Request(
        `https://site.netlify/.netlify/images?url=${encodeURIComponent(`${remoteServerAddress}/allowed/image`)}&w=100`,
      )
      const allowedRemoteImageResponse = await dev.handle(allowedRemoteImageRequest)
      expect(allowedRemoteImageResponse?.ok).toBe(true)
      expect(allowedRemoteImageResponse?.headers.get('content-type')).toMatch(/^image\//)
      expect(
        await getImageResponseSize(allowedRemoteImageResponse ?? new Response('No @netlify/dev response')),
      ).toMatchObject({ width: 100, height: 50 })

      const allowedRemoteImage2Request = new Request(
        `https://site.netlify/.netlify/images?url=${encodeURIComponent(`${remoteServerAddress}/allowed-via-option/image`)}&w=100`,
      )
      const allowedRemoteImage2Response = await dev.handle(allowedRemoteImage2Request)
      expect(allowedRemoteImage2Response?.ok).toBe(true)
      expect(allowedRemoteImage2Response?.headers.get('content-type')).toMatch(/^image\//)
      expect(
        await getImageResponseSize(allowedRemoteImage2Response ?? new Response('No @netlify/dev response')),
      ).toMatchObject({ width: 100, height: 50 })

      const notAllowedRemoteImageRequest = new Request(
        `https://site.netlify/.netlify/images?url=${encodeURIComponent(`${remoteServerAddress}/not-allowed/image`)}&w=100`,
      )
      const notAllowedRemoteImageResponse = await dev.handle(notAllowedRemoteImageRequest)
      expect(notAllowedRemoteImageResponse?.status).toBe(403)

      const rewriteImageRequest = new Request(
        `https://site.netlify/image-cdn-rewrite?url=${encodeURIComponent('local/image.jpg')}&w=100`,
      )
      const rewriteImageResponse = await dev.handle(rewriteImageRequest)
      expect(rewriteImageResponse?.ok).toBe(true)
      expect(rewriteImageResponse?.headers.get('content-type')).toMatch(/^image\//)
      expect(
        await getImageResponseSize(rewriteImageResponse ?? new Response('No @netlify/dev response')),
      ).toMatchObject({ width: 100, height: 50 })

      await remoteServer.stop()
      await dev.stop()
      await fixture.destroy()
    })

    test('Invoking an edge function', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
           publish = "public"
           [context.dev.environment]
           MY_TOKEN = "value from dev context"
           [context.deploy-preview.environment]
           MY_OTHER_TOKEN = "value from deploy preview context"
        `,
        )
        .withFile(
          'netlify/functions/hello.mjs',
          `export default async (req, context) => new Response("Hello from function");

           export const config = { path: "/hello/:a/*" };`,
        )
        .withFile(
          'netlify/edge-functions/passthrough.mjs',
          `export default async (req, context) => {
            const res = await context.next();
            const text = await res.text();

            return new Response(text.toUpperCase(), res);
          };

           export const config = { path: "/hello/passthrough/*" };`,
        )
        .withFile(
          'netlify/edge-functions/terminate.mjs',
          `export default async (req, context) => Response.json({
             runtimeEnv: {
               NETLIFY_BLOBS_CONTEXT: Netlify.env.get("NETLIFY_BLOBS_CONTEXT"),
             },
             platformEnv: {
               DEPLOY_ID: Netlify.env.get("DEPLOY_ID"),
             },
             configEnv: {
               MY_TOKEN: Netlify.env.get("MY_TOKEN"),
               MY_OTHER_TOKEN: Netlify.env.get("MY_OTHER_TOKEN"),
             },
             parentProcessEnv: {
               SOME_ZSH_THING_MAYBE: Netlify.env.get("SOME_ZSH_THING_MAYBE"),
             },
             geo: context.geo,
             params: context.params,
             path: context.path,
             server: context.server,
             site: context.site,
             url: context.url,
           });

           export const config = { path: "/hello/terminate/*" };`,
        )
      const directory = await fixture.create()

      vi.stubEnv('SOME_ZSH_THING_MAYBE', 'value on developer machine')

      const dev = new NetlifyDev({
        apiToken: 'token',
        projectRoot: directory,
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        }
      })

      const { serverAddress } = await dev.start()

      const req1 = new Request('https://site.netlify/hello/passthrough/two/three')
      const res1 = await dev.handle(req1)

      expect(await res1?.text()).toBe('HELLO FROM FUNCTION')

      const req2 = new Request('https://site.netlify/hello/terminate/two/three')
      const res2 = await dev.handle(req2)
      const req2URL = new URL('/hello/terminate/two/three', serverAddress)

      expect(await res2?.json()).toStrictEqual({
        // Env vars emulating the EF runtime are present
        runtimeEnv: {
          NETLIFY_BLOBS_CONTEXT: expect.stringMatching(/\w+/) as unknown,
        },
        // Env vars emulating the EF runtime are present
        // Note that these originate from `@netlify/config`
        platformEnv: {
          DEPLOY_ID: '0',
        },
        // Envs var set in `netlify.toml` for `dev` context only are passed to EFs
        configEnv: {
          MY_TOKEN: 'value from dev context',
          // MY_OTHER_TOKEN is not present
        },
        parentProcessEnv: {
          // SOME_ZSH_THING_MAYBE is not present
        },

        geo: {
          city: 'San Francisco',
          country: {
            code: 'US',
            name: 'United States',
          },
          latitude: 0,
          longitude: 0,
          subdivision: {
            code: 'CA',
            name: 'California',
          },
          timezone: 'UTC',
        },
        params: {
          '0': 'two/three',
        },
        server: {
          region: 'dev',
        },
        site: {
          url: serverAddress,
        },
        url: req2URL.toString(),
      })

      await dev.stop()
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
            key: 'WITH_DEV_OVERRIDE',
            scopes: ['builds', 'functions', 'runtime'],
            values: [
              { context: 'dev' as const, value: 'value from dev context' },
              { context: 'production' as const, value: 'value from production context' },
              { context: 'all' as const, value: 'value from all context' },
            ],
          },
          {
            key: 'WITHOUT_DEV_OVERRIDE',
            scopes: ['builds', 'functions', 'runtime'],
            values: [
              { context: 'branch-deploy' as const, value: 'value from branch-deploy context' },
              { context: 'production' as const, value: 'value from production context' },
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
        .withFile(
          'netlify/functions/hello.mjs',
          `export default async (req, context) => Response.json({
             env: {
               WITH_DEV_OVERRIDE: Netlify.env.get("WITH_DEV_OVERRIDE"),
               WITHOUT_DEV_OVERRIDE: Netlify.env.get("WITHOUT_DEV_OVERRIDE")
             },
             geo: context.geo,
             params: context.params,
             path: context.path,
             server: context.server,
             site: context.site,
             url: context.url
           });

           export const config = { path: "/hello/:a/*" };`,
        )
        .withStateFile({ siteId: 'site_id' })
      const directory = await fixture.create()
      const req = new Request('https://site.netlify/hello/one/two/three')

      await withMockApi(routes, async (context) => {
        const dev = new NetlifyDev({
          apiURL: context.apiUrl,
          apiToken: 'token',
          projectRoot: directory,
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        },
        })

        await dev.start()

        const res = await dev.handle(req)

        await dev.stop()

        expect(await res?.json()).toStrictEqual({
          env: {
            WITH_DEV_OVERRIDE: 'value from dev context',
            WITHOUT_DEV_OVERRIDE: 'value from all context',
          },
          geo: {
            city: 'San Francisco',
            country: {
              code: 'US',
              name: 'United States',
            },
            latitude: 0,
            longitude: 0,
            subdivision: {
              code: 'CA',
              name: 'California',
            },
            timezone: 'UTC',
          },
          params: {
            '0': 'two/three',
            a: 'one',
          },
          path: '/hello/:a/*',
          server: {
            region: 'dev',
          },
          site: {
            id: 'site_id',
            name: 'site-name',
          },
          url: 'https://site.netlify/hello/one/two/three',
        })
      })

      await fixture.destroy()
    })

    test('Invoking an edge function', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
           publish = "public"
           [context.dev.environment]
           MY_TOKEN = "value from dev context"
           [context.deploy-preview.environment]
           MY_OTHER_TOKEN = "value from deploy preview context"
        `,
        )
        .withFile(
          'netlify/functions/hello.mjs',
          `export default async (req, context) => new Response("Hello from function");

           export const config = { path: "/hello/:a/*" };`,
        )
        .withFile(
          'netlify/edge-functions/passthrough.mjs',
          `export default async (req, context) => {
            const res = await context.next();
            const text = await res.text();

            return new Response(text.toUpperCase(), res);
          };

           export const config = { path: "/hello/passthrough/*" };`,
        )
        .withFile(
          'netlify/edge-functions/terminate.mjs',
          `export default async (req, context) => Response.json({
             siteEnv: {
               WITH_DEV_OVERRIDE: Netlify.env.get("WITH_DEV_OVERRIDE"),
               WITHOUT_DEV_OVERRIDE: Netlify.env.get("WITHOUT_DEV_OVERRIDE"),
             },
             runtimeEnv: {
               NETLIFY_BLOBS_CONTEXT: Netlify.env.get("NETLIFY_BLOBS_CONTEXT"),
             },
             platformEnv: {
               DEPLOY_ID: Netlify.env.get("DEPLOY_ID"),
             },
             configEnv: {
               MY_TOKEN: Netlify.env.get("MY_TOKEN"),
               MY_OTHER_TOKEN: Netlify.env.get("MY_OTHER_TOKEN"),
             },
             parentProcessEnv: {
               SOME_ZSH_THING_MAYBE: Netlify.env.get("SOME_ZSH_THING_MAYBE"),
             },
             geo: context.geo,
             params: context.params,
             path: context.path,
             server: context.server,
             site: context.site,
             url: context.url,
           });

           export const config = { path: "/hello/terminate/*" };`,
        )
        .withStateFile({ siteId: 'site_id' })
      const directory = await fixture.create()

      await withMockApi(routes, async (context) => {
        vi.stubEnv('SOME_ZSH_THING_MAYBE', 'value on developer machine')

        const dev = new NetlifyDev({
          apiURL: context.apiUrl,
          apiToken: 'token',
          projectRoot: directory,
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        },
        })

        const { serverAddress } = await dev.start()

        const req1 = new Request('https://site.netlify/hello/passthrough/two/three')
        const res1 = await dev.handle(req1)

        expect(await res1?.text()).toBe('HELLO FROM FUNCTION')

        const req2 = new Request('https://site.netlify/hello/terminate/two/three')
        const res2 = await dev.handle(req2)
        const req2URL = new URL('/hello/terminate/two/three', serverAddress)

        expect(await res2?.json()).toStrictEqual({
          // Env vars set on the site ("UI") are passed to EFs
          siteEnv: {
            WITH_DEV_OVERRIDE: 'value from dev context',
            WITHOUT_DEV_OVERRIDE: 'value from all context',
          },
          // Env vars emulating the EF runtime are present
          // TODO(serhalp): Test conditionally injected `NETLIFY_PURGE_API_TOKEN`
          // TODO(serhalp): Finish implementing and test conditionally injected `BRANCH`
          runtimeEnv: {
            NETLIFY_BLOBS_CONTEXT: expect.stringMatching(/\w+/) as unknown,
          },
          // Env vars emulating the EF runtime are present
          // Note that these originate from `@netlify/config`
          platformEnv: {
            DEPLOY_ID: '0',
          },
          // Envs var set in `netlify.toml` for `dev` context only are passed to EFs
          configEnv: {
            MY_TOKEN: 'value from dev context',
            // MY_OTHER_TOKEN is not present
          },
          parentProcessEnv: {
            // SOME_ZSH_THING_MAYBE is not present
          },
          // TODO(serhalp): Implement and test support for `.env.*` files (exists in CLI)

          geo: {
            city: 'San Francisco',
            country: {
              code: 'US',
              name: 'United States',
            },
            latitude: 0,
            longitude: 0,
            subdivision: {
              code: 'CA',
              name: 'California',
            },
            timezone: 'UTC',
          },
          params: {
            '0': 'two/three',
          },
          // TODO: This doesn't exist in edge functions but it should.
          // path: '/hello/terminate/*',
          server: {
            region: 'dev',
          },
          site: {
            id: 'site_id',
            name: 'site-name',
            url: serverAddress,
          },
          url: req2URL.toString(),
        })

        await dev.stop()
      })

      await fixture.destroy()
    })

    test('Invoking a function that shadows a static file and introspecting the result', async () => {
      const fixture = new Fixture()
        .withFile(
          'netlify.toml',
          `[build]
        publish = "public"
        `,
        )
        .withFile(
          'netlify/functions/greeting.mjs',
          `export default async (req, context) => new Response(context.params.greeting + ", friend!");

           export const config = { path: "/:greeting", preferStatic: true };`,
        )
        .withFile('public/hello.html', '<html>Hello</html>')
        .withStateFile({ siteId: 'site_id' })
      const directory = await fixture.create()

      await withMockApi(routes, async (context) => {
        const dev = new NetlifyDev({
          apiURL: context.apiUrl,
          apiToken: 'token',
          projectRoot: directory,
        edgeFunctions: {
          geolocation: {
            mode: 'mock'
          }
        },
        })

        await dev.start()

        const req1 = new Request('https://site.netlify/hi')
        const res1 = await dev.handleAndIntrospect(req1)

        expect(await res1?.response.text()).toBe('hi, friend!')
        expect(res1?.type).toBe('function')

        const req2 = new Request('https://site.netlify/hello')
        const res2 = await dev.handleAndIntrospect(req2)

        expect(await res2?.response.text()).toBe('<html>Hello</html>')
        expect(res2?.type).toBe('static')

        await dev.stop()
      })

      await fixture.destroy()
    })
  })
})
