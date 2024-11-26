# Netlify Primitives

> [!IMPORTANT]  
> This is a proof-of-concept, not yet ready for production use.

This is a monorepo containing the various Netlify platform primitives as self-contained packages. Each package contains all the logic required to interact with the primitive at runtime, but also all the scaffolding needed to run the primitive in local development.

Currently, the local development logic for all primitives lives inside the CLI monolith, which makes them impossible to interact with when not using the CLI (e.g. when using a framework through Vite). Also, it makes the CLI itself complex and therefore harder to iterate on.

By moving the different primitives into self-contained, composable packages, we can start paving the way for a modular CLI and different entry points into our platform, as described in [the "Imagining a new Netlify CLI" document](https://www.notion.so/netlify/Imagining-a-new-Netlify-CLI-0d1e8a0e5a3f4b579e2df1d59cb20376).

This would let us have a middleware specifically for handling certain primitives, like [functions](packages/functions/src/dev/middleware.test.ts), which we can hook up to any underlying tool that brings its own HTTP server (like Vite).

But we could also combine the different primitives and build our own HTTP server that mimics the Netlify platform, which we could use to power local development in the CLI. It could look like this:

```ts
import { Middleware, Server } from "@netlify/dev"
import { withFunctions } from "@netlify/functions/dev"
import { withRedirects } from "@netlify/redirects/dev"
import { withStatic } from "@netlify/static/dev"

const with404: Middleware = () => new Response("Nothing here!", { status: 404 })

const server = new Server()
  .use(withRedirects())
  .use(withFunctions())
  .use(withStatic())
  .use(with404)

const address = await server.start()

const response = await fetch(address)
await response.text()

await server.stop()
```
