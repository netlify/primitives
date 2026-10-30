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
  size: 'medium',
  scale: { max: 2 },
}
```

- `region`: airport code for the region where the server runs, `cmh` or `fra`.
- `size`: size of the instances the server runs on, `small`, `medium` or `large`. Defaults to `small`.
- `scale`: how many instances the server can run at once. `min` is how many it keeps running at all times, regardless of
  traffic, defaulting to 0, and `max` is how many it scales to, defaulting to the highest your plan allows.

The server handles every path that the rest of the site doesn't claim, which is what most servers want. To narrow that
down, `path` takes one or more URL paths for the server to handle, and `excludedPath` takes paths within them that it
shouldn't. Paths start with `/`.

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

`onShutdown` registers a hook that runs as soon as the instance starts shutting down, when it stops receiving new
traffic. Requests, WebSockets and background work already in progress keep running. The hook receives `drained`, a
promise that resolves once they have all finished. Act straight away on anything that only stops when told, and await
`drained` before closing resources the work in progress may still be using.

```js
const { onShutdown, onStart } = require('@netlify/server')

onStart(async () => {
  await db.connect()
  app.listen(process.env.PORT)
})

onShutdown(async ({ drained }) => {
  queue.stop()

  await drained
  await db.end()
})
```

`drained` also resolves if the platform stops waiting with work still in progress.

Start hooks run one at a time, in registration order. Shutdown hooks run at the same time, so one that awaits `drained`
doesn't hold back the others, and they share a bounded grace period.

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

`getWebSockets()` returns the connections the instance has open, which is how you close them all when it shuts down.
Closing with code `1012` tells clients that the server is restarting, so they can reconnect straight away and reach a
new instance.

```ts
import { getWebSockets, onShutdown } from '@netlify/server'

onShutdown(() => {
  for (const socket of getWebSockets()) {
    socket.close(1012, 'Server restarting')
  }
})
```
