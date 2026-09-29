import { promises as fs } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { FileWatcher, type Logger } from '@netlify/dev-utils'
import { afterEach, assert, expect, test, vi } from 'vitest'
import { WebSocket } from 'ws'

import { ServerHandler } from './main.js'

const fixturesDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures')

// Serving requires Node.js 24; on older versions we can only test the error.
const unsupportedNodeVersion = Number.parseInt(process.versions.node) < 24

const logger: Logger = {
  error: () => {},
  log: () => {},
  warn: () => {},
}

const cleanupJobs: (() => Promise<void> | void)[] = []

afterEach(async () => {
  while (cleanupJobs.length !== 0) {
    await cleanupJobs.pop()?.()
  }
})

const createHandler = (projectRoot: string, options: Partial<ConstructorParameters<typeof ServerHandler>[0]> = {}) => {
  const handler = new ServerHandler({
    logger,
    projectRoot,
    ...options,
  })

  cleanupJobs.push(() => handler.stop())

  return handler
}

test('does not match when there is no server entrypoint', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'server-dev-'))
  cleanupJobs.push(() => fs.rm(projectRoot, { force: true, recursive: true }))

  const handler = createHandler(projectRoot)

  expect(await handler.match(new Request('http://localhost/'))).toBeUndefined()
})

test.runIf(unsupportedNodeVersion)('fails with a clear error on Node.js versions below 24', async () => {
  const handler = createHandler(path.join(fixturesDirectory, 'basic'))

  await expect(handler.match(new Request('http://localhost/'))).rejects.toThrowError(/requires Node\.js 24 or above/)
})

test.skipIf(unsupportedNodeVersion)(
  'matches every path with static preference and serves through the platform bootstrap',
  async () => {
    process.env.SERVER_DEV_TEST_VAR = 'from-parent-env'
    cleanupJobs.push(() => {
      delete process.env.SERVER_DEV_TEST_VAR
    })

    const handler = createHandler(path.join(fixturesDirectory, 'basic'), {
      geolocation: { city: 'Lisbon' },
      siteID: 'site-123',
    })

    const match = await handler.match(new Request('http://localhost/some/deep/path?value=1'))

    assert(match)
    expect(match.preferStatic).toBe(true)

    const response = await match.handle(new Request('http://localhost/some/deep/path?value=1'))
    expect(response.status).toBe(200)

    const body = (await response.json()) as Record<string, unknown>

    expect(body.url).toBe('/some/deep/path?value=1')
    expect(body.siteID).toBe('site-123')
    expect(body.capturedAtImport).toBe('from-parent-env')
    expect(JSON.parse(Buffer.from(body.geo as string, 'base64').toString('utf8'))).toEqual({ city: 'Lisbon' })

    // A second request must hit the same process.
    const secondMatch = await handler.match(new Request('http://localhost/again'))

    assert(secondMatch)

    const secondBody = (await (await secondMatch.handle(new Request('http://localhost/again'))).json()) as Record<
      string,
      unknown
    >

    expect(secondBody.pid).toBe(body.pid)
  },
)

test.skipIf(unsupportedNodeVersion)('serves a fetch-form entry', async () => {
  const handler = createHandler(path.join(fixturesDirectory, 'fetch'))

  const match = await handler.match(new Request('http://localhost/fetch-path'))

  assert(match)

  const response = await match.handle(new Request('http://localhost/fetch-path'))
  expect(response.status).toBe(200)

  const body = (await response.json()) as Record<string, unknown>

  expect(body.form).toBe('fetch')
  expect(body.url).toBe('/fetch-path')
})

test.skipIf(unsupportedNodeVersion)('serves a TypeScript entry through native type stripping', async () => {
  const handler = createHandler(path.join(fixturesDirectory, 'typescript'))

  const match = await handler.match(new Request('http://localhost/ts-path'))

  assert(match)

  const response = await match.handle(new Request('http://localhost/ts-path'))
  expect(response.status).toBe(200)

  const body = (await response.json()) as Record<string, unknown>

  expect(body.typescript).toBe(true)
  expect(body.url).toBe('/ts-path')
})

test('fails with a clear error when there are multiple entrypoints', async () => {
  const handler = createHandler(path.join(fixturesDirectory, 'multiple-entries'))

  await expect(handler.match(new Request('http://localhost/'))).rejects.toThrowError(
    /Found multiple server entrypoints/,
  )
})

test.skipIf(unsupportedNodeVersion)('restarts the server process when the entrypoint changes', async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'server-dev-'))
  cleanupJobs.push(() => fs.rm(projectRoot, { force: true, recursive: true }))

  const serverDirectory = path.join(projectRoot, 'netlify', 'server')
  await fs.mkdir(serverDirectory, { recursive: true })
  await fs.copyFile(
    path.join(fixturesDirectory, 'basic', 'netlify', 'server', 'index.mjs'),
    path.join(serverDirectory, 'index.mjs'),
  )

  const fileWatcher = new FileWatcher()
  cleanupJobs.push(() => fileWatcher.close())

  const handler = createHandler(projectRoot, { fileWatcher })

  const getPid = async () => {
    const match = await handler.match(new Request('http://localhost/'))

    assert(match)

    const response = await match.handle(new Request('http://localhost/'))
    const body = (await response.json()) as { pid: number }

    return body.pid
  }

  // Retried because the watcher can replay the fixture copy as an event right
  // after subscribing, restarting the server mid-boot and failing one request.
  const firstPid = await vi.waitFor(getPid, { interval: 250, timeout: 15_000 })

  await fs.appendFile(path.join(serverDirectory, 'index.mjs'), '\n// touched\n')

  await vi.waitFor(
    async () => {
      expect(await getPid()).not.toBe(firstPid)
    },
    { interval: 250, timeout: 15_000 },
  )
})

test.skipIf(unsupportedNodeVersion)('pipes WebSocket upgrades to the server process', async () => {
  const handler = createHandler(path.join(fixturesDirectory, 'websocket'))

  // A host server, standing in for whatever runs `NetlifyDev` (CLI, plugin).
  const host: Server = createServer((nodeRequest, nodeResponse) => {
    void (async () => {
      const url = `http://localhost${nodeRequest.url ?? '/'}`
      const match = await handler.match(new Request(url))

      assert(match)

      const response = await match.handle(new Request(url))

      nodeResponse.writeHead(response.status)
      nodeResponse.end(Buffer.from(await response.arrayBuffer()))
    })()
  })

  host.on('upgrade', (nodeRequest, socket, head) => {
    handler.handleUpgrade(nodeRequest, socket, head).catch(() => {
      socket.destroy()
    })
  })

  host.listen(0, '127.0.0.1')
  await once(host, 'listening')
  cleanupJobs.push(
    () =>
      new Promise<void>((resolve) => {
        host.close(() => {
          resolve()
        })
      }),
  )

  const { port } = host.address() as { port: number }

  const httpResponse = await fetch(`http://127.0.0.1:${String(port)}/`)
  expect(await httpResponse.text()).toBe('http')

  const ws = new WebSocket(`ws://127.0.0.1:${String(port)}/ws`)
  await once(ws, 'open')

  const reply = new Promise<string>((resolve) => {
    ws.once('message', (message) => {
      resolve((message as Buffer).toString('utf8'))
    })
  })

  ws.send('hello')
  expect(await reply).toBe('echo:hello')

  ws.close()
})
