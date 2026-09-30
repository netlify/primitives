# @netlify/server

TypeScript utilities for Netlify Server.

## Installation

```
npm install @netlify/server
```

## Usage

### Configuration

Export a `config` object from the server's entry file. This works whether the file exports a Netlify handler, a
fetch-style app, or nothing at all because it starts its own server.

```ts
import type { Config } from '@netlify/server'

export const config: Config = {
  region: 'fra',
}
```

### Request context

`getContext()` returns the Netlify context of the request being handled, from anywhere in the code that runs for it,
including framework route handlers and middleware.

```js
const { getContext } = require('@netlify/server')

app.get('/', (req, res) => {
  res.send(`Hello from ${getContext().geo.country?.name}!`)
})
```

### Lifecycle hooks

`onStart` registers a hook that runs after the entry file has loaded and before the instance receives traffic. The
instance waits for it, and fails to start if it throws. This is how code that cannot use top-level `await`, such as a
CommonJS app, holds traffic until it is ready.

`onShutdown` registers a hook that runs when the instance is being recycled, after it stops receiving traffic.

```js
const { onShutdown, onStart } = require('@netlify/server')

onStart(async () => {
  await db.connect()
  app.listen(process.env.PORT)
})

onShutdown(async () => {
  await db.end()
})
```

Hooks of each kind run one at a time, in registration order. Shutdown hooks share a bounded grace period.

### Health checks

`onHealthCheck` registers a hook that reports how loaded the instance is. The platform already measures each instance's
event loop and memory, and a hook lets you add the resources only your code knows about, such as a connection pool or a
job queue. The platform uses the highest `utilization` entry to decide whether to send the instance new requests and
when to start more instances.

```js
const { onHealthCheck } = require('@netlify/server')

onHealthCheck(() => ({
  utilization: { db_pool: (pool.totalCount - pool.idleCount) / pool.options.max },
  namedMetrics: { db_pool_waiting: pool.waitingCount },
}))

onHealthCheck(
  async () => {
    const { waiting } = await queue.getJobCounts('waiting')

    return { utilization: { job_queue: Math.min(1, waiting / MAX_QUEUE) } }
  },
  { interval: 10_000 },
)
```

The platform calls each hook in the background, at most once per `interval` (1 second by default, and at least 1
second), so a hook can be synchronous or asynchronous. `utilization` entries are fractions between 0 and 1,
`applicationUtilization` replaces the overall figure, and `namedMetrics` are recorded for observability only. A hook
that throws or returns nothing contributes nothing, and never marks the instance as unhealthy.

### WebSockets

`upgradeWebSocket(request, options?)` upgrades a request received by a handler or a fetch-style app to a WebSocket
connection. It returns two things:

- `socket`: a `WebSocket` for the server side of the connection, with the same interface as the browser's: `send()`,
  `close()`, `readyState`, and the `open`, `message`, `close`, and `error` events, through `addEventListener()` or the
  `on*` properties. Closing events are `CloseEvent`s, with the same `code`, `reason`, and `wasClean` properties as the
  browser's.
- `response`: the `Response` to return from your handler, which completes the upgrade.

The optional `options` object takes a `protocol` to accept, and an `idleTimeout` in seconds after which a client that
stops answering pings is disconnected.

`WebSocket` and `CloseEvent` are exported too, for type annotations and `instanceof` checks.

```ts
import { upgradeWebSocket } from '@netlify/server'

export default async (req: Request) => {
  if (req.headers.get('upgrade') === 'websocket') {
    const { socket, response } = upgradeWebSocket(req)

    socket.onmessage = (event) => socket.send(`Echo: ${event.data}`)

    return response
  }

  return new Response('Connect with a WebSocket client')
}
```
