# @netlify/dev

[![@netlify/dev version](https://npmx.dev/api/registry/badge/version/@netlify/dev?color=28b5ac&name=true)](https://npmx.dev/package/@netlify/dev)
[![license](https://npmx.dev/api/registry/badge/license/@netlify/dev?color=28b5ac)](https://npmx.dev/package/@netlify/dev)
[![node](https://npmx.dev/api/registry/badge/engines/@netlify/dev?color=28b5ac)](https://npmx.dev/package/@netlify/dev)
[![downloads/mo](https://npmx.dev/api/registry/badge/downloads/@netlify/dev?color=28b5ac)](https://npmx.dev/package/@netlify/dev)

`@netlify/dev` is a local emulator for the Netlify production environment. While it can be used directly by advanced
users, it is primarily designed as a foundational library for higher-level tools like the
[Netlify CLI](https://docs.netlify.com/cli/get-started/) and the
[Netlify Vite Plugin](https://docs.netlify.com/integrations/vite/overview/).

It provides a local request pipeline that mimics the Netlify platform’s request handling, including support for
Functions, Edge Functions, Netlify Server, Blobs, Netlify Database, Static files, Redirects, AI Gateway, and Image CDN.

## 📦 Installation

```bash
npm install @netlify/dev
```

or

```bash
yarn add @netlify/dev
```

## 🚀 Usage

You can use `@netlify/dev` to emulate the Netlify runtime in your own development tooling or custom integrations:

```ts
import { NetlifyDev } from '@netlify/dev'

const devServer = new NetlifyDev({
  blobs: { enabled: true },
  edgeFunctions: { enabled: true },
  environmentVariables: { enabled: true },
  functions: { enabled: true },
  redirects: { enabled: true },
  staticFiles: {
    enabled: true,
    // OPTIONAL: additional directories containing static files to serve
    // Your `projectRoot` (see below) and your site's `publish` dir are served by default
    directories: ['public'],
  },

  // OPTIONAL: base dir (https://docs.netlify.com/configure-builds/overview/#definitions)
  // Defaults to current working directory
  projectRoot: 'site',
  // OPTIONAL: if your local dev setup has its own HTTP server (e.g. Vite), set its address here
  serverAddress: 'http://localhost:1234',
})

await devServer.start()

const response = await devServer.handle(new Request('http://localhost:8888/path'), {
  // An optional callback that will be called with every header (key and value) coming from header rules.
  // See https://docs.netlify.com/routing/headers/
  headersCollector: (key: string, value: string) => console.log(key, value),
})

console.log(await response.text())

await devServer.stop()
```

Every feature is enabled by default. Pass `{ enabled: false }` to turn one off.

### Netlify Server

If the project has a server entry file at `netlify/server/index.{js,mjs,ts,mts}`, `@netlify/dev` runs it in a child
process and sends it every request that isn't handled by a static file, an edge function or a function. The process
starts on the first request and restarts when a file in `netlify/server/` changes. Its stdout goes to `logger.log` and
its stderr to `logger.error`. Netlify Server requires Node.js 24 or above.

`handle()` only takes `Request` objects, so WebSocket and other upgrade requests have to be passed to `handleUpgrade()`
from your HTTP server's `upgrade` event. It returns `false` without touching the socket when there's no server to take
the connection, so you can pass it to another handler. Otherwise it returns `true` and handles the connection from then
on, including answering with a 502 if the server fails to start.

```ts
import { createServer } from 'node:http'

const httpServer = createServer(/* ... */)

httpServer.on('upgrade', async (request, socket, head) => {
  const handled = await devServer.handleUpgrade(request, socket, head)

  if (!handled) {
    socket.destroy()
  }
})
```

### Netlify Database

`@netlify/dev` starts a local Postgres database, stored in `.netlify/db`, and sets `NETLIFY_DB_URL` so that
`@netlify/database` connects to it. The `db` getter returns the running instance, which you can use to apply migrations
or run queries from your own tooling. Paths passed to it are resolved against the working directory, not `projectRoot`
(`site` in the example above). It's `undefined` when the feature is disabled or the database failed to start.

```ts
import path from 'node:path'

await devServer.db?.applyMigrations(path.join('site', 'netlify/database/migrations'))

const { rows } = await devServer.db!.query('SELECT * FROM posts')
```

## 🧪 Contributing and feedback

This module is **experimental**, and we welcome feedback and contributions. Feel free to open issues or pull requests if
you encounter bugs or have suggestions.
