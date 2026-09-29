import { AsyncLocalStorage } from 'node:async_hooks'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, assert, beforeEach, describe, expect, test } from 'vitest'
import { WebSocket as WsClient } from 'ws'

import { CloseEvent, getContext, onHealthCheck, onShutdown, onStart, upgradeWebSocket, WebSocket } from './main.js'

// These keys are the contract with the platform, so the tests spell them out
// rather than importing them.
const LIFECYCLE_KEY = Symbol.for('@netlify/server/lifecycle')
const CONTEXT_STORE_KEY = Symbol.for('@netlify/functions/request-context-store')
const REQUEST_PRIMITIVES_KEY = Symbol.for('$netlify.requestNodePrimitives')
const RESPONSE_UPGRADED_KEY = Symbol.for('$netlify.responseUpgraded')

const globalRef = globalThis as Record<symbol, unknown>

interface Lifecycle {
  start: (() => unknown)[]
  shutdown: (() => unknown)[]
  health: { hook: () => unknown; interval: number }[]
  started: boolean
}

beforeEach(() => {
  Reflect.deleteProperty(globalRef, LIFECYCLE_KEY)
  Reflect.deleteProperty(globalRef, CONTEXT_STORE_KEY)
})

describe('onStart', () => {
  test('Registers hooks where the platform reads them, in order', () => {
    const first = () => {}
    const second = async () => {}

    onStart(first)
    onStart(second)

    expect((globalRef[LIFECYCLE_KEY] as Lifecycle).start).toEqual([first, second])
  })

  test('Joins a registry the platform created first', () => {
    const lifecycle: Lifecycle = { start: [], shutdown: [], health: [], started: false }
    const hook = () => {}

    globalRef[LIFECYCLE_KEY] = lifecycle
    onStart(hook)

    expect(lifecycle.start).toEqual([hook])
  })

  test('Throws once the server has started, since nothing would run the hook', () => {
    globalRef[LIFECYCLE_KEY] = { start: [], shutdown: [], health: [], started: true }

    expect(() => {
      onStart(() => {})
    }).toThrow('onStart() was called after the server started')
  })

  test('Throws when given something other than a function', () => {
    expect(() => {
      onStart('nope' as unknown as () => void)
    }).toThrow(TypeError)
  })
})

describe('onHealthCheck', () => {
  test('Registers hooks where the platform reads them, with a one-second interval by default', () => {
    const cheap = () => ({ utilization: { db_pool: 0.5 } })
    const slow = () => Promise.resolve({ namedMetrics: { queue_length: 3 } })

    onHealthCheck(cheap)
    onHealthCheck(slow, { interval: 10_000 })

    expect((globalRef[LIFECYCLE_KEY] as Lifecycle).health).toEqual([
      { hook: cheap, interval: 1000 },
      { hook: slow, interval: 10_000 },
    ])
  })

  test('Accepts hooks after the server has started', () => {
    globalRef[LIFECYCLE_KEY] = { start: [], shutdown: [], health: [], started: true }

    onHealthCheck(() => {})

    expect((globalRef[LIFECYCLE_KEY] as Lifecycle).health).toHaveLength(1)
  })

  test.each([500, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])('Throws on an interval of %s', (interval) => {
    expect(() => {
      onHealthCheck(() => {}, { interval })
    }).toThrow(RangeError)
  })

  test('Throws when given something other than a function', () => {
    expect(() => {
      onHealthCheck('nope' as unknown as () => void)
    }).toThrow(TypeError)
  })
})

describe('onShutdown', () => {
  test('Registers hooks where the platform reads them, in order', () => {
    const first = () => {}
    const second = async () => {}

    onShutdown(first)
    onShutdown(second)

    expect((globalRef[LIFECYCLE_KEY] as Lifecycle).shutdown).toEqual([first, second])
  })

  test('Accepts hooks after the server has started', () => {
    globalRef[LIFECYCLE_KEY] = { start: [], shutdown: [], health: [], started: true }

    const hook = () => {}

    onShutdown(hook)

    expect((globalRef[LIFECYCLE_KEY] as Lifecycle).shutdown).toEqual([hook])
  })

  test('Throws when given something other than a function', () => {
    expect(() => {
      onShutdown(undefined as unknown as () => void)
    }).toThrow(TypeError)
  })
})

describe('getContext', () => {
  test('Returns the context of the request the platform is handling', async () => {
    const store = new AsyncLocalStorage<{ context: unknown }>()
    const context = { requestId: 'abc' }

    globalRef[CONTEXT_STORE_KEY] = store

    const seen = await store.run({ context }, async () => {
      await Promise.resolve()

      return getContext()
    })

    expect(seen).toBe(context)
  })

  test('Throws outside of a request', () => {
    globalRef[CONTEXT_STORE_KEY] = new AsyncLocalStorage()

    expect(() => getContext()).toThrow('getContext() can only be called while a Netlify Server is handling a request.')
  })

  test('Throws when no platform is running', () => {
    expect(() => getContext()).toThrow('getContext() can only be called while a Netlify Server is handling a request.')
  })
})

describe('upgradeWebSocket', () => {
  let server: Server | undefined

  afterEach(async () => {
    const running = server

    server = undefined

    if (running) {
      running.closeAllConnections()
      await new Promise((resolve) => {
        running.close(resolve)
      })
    }
  })

  // Hands upgrades to `handler` the way the platform does: as a `Request`
  // carrying the raw primitives, completing the upgrade only if the response
  // it returns is marked as upgraded.
  const startPlatform = async (handler: (request: Request) => Response) => {
    const responses: Response[] = []
    const platform = createServer()

    server = platform
    platform.on('upgrade', (req, socket, head) => {
      const request = new Request(`http://localhost${req.url ?? '/'}`, {
        headers: req.headers as Record<string, string>,
      })

      Object.defineProperty(request, REQUEST_PRIMITIVES_KEY, { value: { request: req, socket, head } })

      const response = handler(request)

      responses.push(response)

      if (!(response as Response & Record<symbol, unknown>)[RESPONSE_UPGRADED_KEY]) {
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      }
    })

    await new Promise<void>((resolve) => {
      platform.listen(0, '127.0.0.1', resolve)
    })

    return { port: (platform.address() as AddressInfo).port, responses }
  }

  const connect = (port: number, protocols?: string[]) => {
    const client = new WsClient(`ws://127.0.0.1:${String(port)}/socket`, protocols)

    return new Promise<WsClient>((resolve, reject) => {
      client.once('open', () => {
        resolve(client)
      })
      client.once('error', reject)
    })
  }

  test('Throws for a request the platform did not receive', () => {
    expect(() => upgradeWebSocket(new Request('http://localhost'))).toThrow(
      'upgradeWebSocket() can only upgrade a request received by a Netlify Server.',
    )
  })

  test('Exchanges text and binary messages over a browser-style socket', async () => {
    const { port, responses } = await startPlatform((request) => {
      const { socket, response } = upgradeWebSocket(request)

      socket.binaryType = 'arraybuffer'
      socket.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          socket.send(`echo: ${event.data}`)
        } else {
          socket.send(new Uint8Array(event.data as ArrayBuffer).reverse())
        }
      }

      return response
    })

    const client = await connect(port)
    const replies: (string | Buffer)[] = []
    const received = new Promise<void>((resolve) => {
      client.on('message', (data: Buffer, isBinary) => {
        replies.push(isBinary ? data : data.toString())

        if (replies.length === 2) {
          resolve()
        }
      })
    })

    client.send('hi')
    client.send(Buffer.from([1, 2, 3]))
    await received

    expect(replies).toEqual(['echo: hi', Buffer.from([3, 2, 1])])
    expect(responses[0]).toBeInstanceOf(Response)

    client.close()
  })

  test('Fires open, then close with the code the client sent', async () => {
    const events: string[] = []
    let closed: () => void
    const closedPromise = new Promise<void>((resolve) => {
      closed = resolve
    })

    const { port } = await startPlatform((request) => {
      const { socket, response } = upgradeWebSocket(request)

      socket.addEventListener('open', () => {
        events.push('open')
      })
      socket.onclose = (event) => {
        events.push(`close:${String(event.code)}:${event.reason}:${String(event.wasClean)}`)
        closed()
      }

      expect(socket).toBeInstanceOf(WebSocket)

      return response
    })

    const client = await connect(port)

    client.close(1000, 'bye')
    await closedPromise

    expect(events).toEqual(['open', 'close:1000:bye:true'])
  })

  test('Behaves like a browser socket: instance constants, handler `this`, clean closes, and sends after close', async () => {
    let socket: WebSocket | undefined
    let handlerThisIsSocket: boolean | undefined
    let closeEvent: CloseEvent | undefined
    let closed: () => void
    const closedPromise = new Promise<void>((resolve) => {
      closed = resolve
    })

    const { port } = await startPlatform((request) => {
      const upgrade = upgradeWebSocket(request)

      socket = upgrade.socket
      socket.onmessage = function () {
        handlerThisIsSocket = this === socket
      }
      socket.onclose = (event) => {
        closeEvent = event
        closed()
      }

      return upgrade.response
    })

    const client = await connect(port)
    const received = new Promise<void>((resolve) => {
      const check = () => {
        if (handlerThisIsSocket !== undefined) {
          resolve()
        } else {
          setImmediate(check)
        }
      }

      check()
    })

    client.send('hi')
    await received

    assert(socket)
    expect(handlerThisIsSocket).toBe(true)
    expect([socket.CONNECTING, socket.OPEN, socket.CLOSING, socket.CLOSED]).toEqual([0, 1, 2, 3])

    // A clean close is one where the closing handshake completed, whatever the
    // code.
    client.close(4000, 'done')
    await closedPromise

    expect(closeEvent).toBeInstanceOf(CloseEvent)
    expect(closeEvent?.code).toBe(4000)
    expect(closeEvent?.wasClean).toBe(true)

    // Like browsers, sending on a closed socket discards the data.
    expect(() => {
      socket?.send('too late')
    }).not.toThrow()
  })

  test('Agrees on the protocol it is given', async () => {
    const { port } = await startPlatform((request) => upgradeWebSocket(request, { protocol: 'chat' }).response)

    const client = await connect(port, ['chat', 'other'])

    expect(client.protocol).toBe('chat')

    client.close()
  })
})
