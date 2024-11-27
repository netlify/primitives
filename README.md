# Netlify Primitives

> [!IMPORTANT]  
> This is a proof-of-concept. Don't use in production!
> For more background, see [this Notion document](https://www.notion.so/netlify/Imagining-a-new-Netlify-CLI-0d1e8a0e5a3f4b579e2df1d59cb20376).

A monorepo containing the runtime and local development components of different Netlify platform primitives.

# Introduction

An HTTP request processed by Netlify will go through a series of hops before it reaches its final destionation and a response is returned. These hops represent the different platform primitives that can augment, transform and make decisions based on the request, depending on the specific configuration of your site.

For example, a given request can flow through an edge function, a redirect rule and a serverless function, whereas a different request for the same site can skip all of those and hit our origin. So it's reasonable to think of Netlify as a series of HTTP handlers (or middleware) that can be composed in different ways to provide different sets of functionality.

In order to provide a good development experience, we need to offer a local development setup that can recreate this setup as accurately as possible, so that people can develop their site on their local machine and be confident that it will behave the same way once deployed to production. Historically, this has been offered by the Netlify CLI with a feature called Netlify Dev. This lets users start an HTTP server that behaves like Netlify by running a single command.

However, a lot has changed in the ecosystem since we first launched this feature. Most notably, the proliferation of build tools like Vite or Nitro (as direct dependencies of different full-stack web frameworks) have fundamentally changed the local development story for a lot of developers. These build tools became the default entry point for developing locally, bringing their own HTTP server, file watching logic, etc.

This puts into question the role of the Netlify CLI in this new world. Rather than trying to offer a competing solution for local development (which is inevitably a losing game, since it means competing with the frameworks themselves), Netlify should try to seamless integrate with and augment those solutions.

To do that, we must start by breaking apart the Netlify Dev monolith and decoupling the primitives logic from each other and from the series of HTTP servers that make up the original implementation. That is the role of this monorepo.

# Architecture

## Module exports

Primitives live as packages in the `packages/` directory and are published as individual npm modules. The main export of each package provides any user-facing logic required for interacting with the feature, if applicable, and the `/dev` export exposes the local development logic.

Let's take Netlify Functions as an example. `@netlify/functions` exposes the `purgeCache` method for purging the cache from a function and `@netlify/functions/dev` contains the logic for finding, matching and serving functions locally.

If we look at redirects as another example, we'll see that `@netlify/redirects` does not expose anything since there's currently no user-facing logic for this primitive, and the local development logic is found in `@netlify/redirects/dev`.

## Middleware

Each package must export its local development logic as a factory that returns a middleware function. A middleware receives a request and decides whether it should serve the response or defer it to the next middleware in the chain. It also has the option to modify the request before passing it along.

Middleware should be runtime-agnostic and therefore HTTP requests and responses are represented as web platform [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) objects.

```ts
import type { Middleware } from "@netlify/dev"

interface EmojifyOptions {
  emoji: string
}

export const withEmojify = ({ emoji }: EmojifyOptions): Middleware => {
  return (request, next) => {
    // The middleware can take over the request and serve the response for it.
    if (request.headers.has("x-some-header")) {
      return new Response(`This request has been emojified: ${emoji}`)
    }

    return next(request)
  }
}
```

As a convention, the name of factory method should be in the format `with<Name of the primitive>` (e.g. `withBlobs`, `withFunctions`).

With this middleware, you can easily integrate this primitive with any build tool by attaching it to its integrated HTTP server.

```ts
import { withEmojify } from "@netlify/emojify/dev"

const middleware = withEmojify({ emoji: "🚀" })
const response = await middleware(new Request("http://localhost/hello"), () => {})
console.log(await response.text())
```

## Server

Rather than interacting with a single primitive, you might want to compose multiple ones together and run a request through that chain. This can be useful when integrating multiple primitives with a build tool that has its own HTTP server or when asserting the functionality of primitives in a test suite.

The `dev` package exposes a `Server` class that makes this extremely convenient. You construct a server, attach the middleware and run your request through the `handleRequest` method.

```ts
import { Middleware, Server } from "@netlify/dev"
import { withFunctions } from "@netlify/functions/dev"
import { withRedirects } from "@netlify/redirects/dev"
import { withStatic } from "@netlify/static/dev"

const server = new Server()
  .use(withRedirects())
  .use(withFunctions())
  .use(withStatic())
  .use(() => new Response("Nothing here!", { status: 404 }))

const response = await server.handleRequest(new Request("http://localhost/hello"))
console.log(await response.text())
```

## HTTP server

If you want to serve the middleware chain over HTTP and you don't already have an HTTP server, the `HTTPServer` class in the `dev` package can handle that for you.

It lets you attach middleware in the exact same way as `Server` (which `HTTPServer` is built on top of), but you now have a `start()` method that actually spins up an HTTP listener and returns the resulting address.

```ts
import { HTTPServer, Middleware } from "@netlify/dev"
import { withFunctions } from "@netlify/functions/dev"
import { withRedirects } from "@netlify/redirects/dev"
import { withStatic } from "@netlify/static/dev"

// Creating a middleware that will run last and catch any requests that have
// not been handled by any other middleware.
const with404: Middleware = () => new Response("Nothing here!", { status: 404 })

const server = new HTTPServer()
  .use(withRedirects())
  .use(withFunctions())
  .use(withStatic())
  .use(with404)

const address = await server.start()

const response = await fetch(address)
console.log(await response.text())
```

## Event bus

While primitives are decoupled, self-contained packages, there's still value in them being able to talk to each other.

For example, imagine we have a primitive that represents the Netlify configuration surfaces, which includes the logic for watching the configuration files and compiling the resulting configuration object. The functions primitive might be interested in knowing whenever this happens, so that it can adjust itself to new directories it should look for functions in, apply new bundling configuration options, etc.

To facilitate this, the `Server` class has a built-in event bus that allows any middleware to broadcast its own events with any payload it wants. Equally, a middleware can subscribe to any events emitted elsewhere in the middleware chain. This pattern enables primitives to receive and send messages while keeping them decoupled from each other, making no assumptions about whether a specific middleware exists and where in the chain it lives.

If a middleware wants to use this event bus, the return value from its factory should be an object with a `handle` and `init` properties. The `handle` property should contain the handler function that processes each request, while `init` is a bootstrap method that receives a reference to a `broadcast` and `subscribe` methods, which let the primitive emit events to the outside world and subscribe to any events it's interested in, respectively.

```ts
import { readFileSync } from "node:fs"
import { type DevEventHandler, type Middleware, watchDebounced } from "@netlify/dev"
import type { UpdatedConfigEvent } from "@netlify/config/dev"

const emojiConfigPath = "/path/to/emojiconfig"
const readEmojiConfig = () => readFileSync(emojiConfigPath, "utf8")

export const withEmojify = (): Middleware => {
  let broadcastEmojiUpdate: DevEventHandler | undefined
  let emoji = readEmojiConfig()

  watchDebounced(emojiConfigPath, {
    onChange: () => {
      broadcastEmojiUpdate?.(readEmojiConfig())
    }
  })

  return {
    handle: (request, next) => {
      // The middleware can take over the request and serve the response for it.
      if (request.headers.has("x-some-header")) {
        return new Response(`Hello from the coolest primitive: ${emoji}`)
      }

      return next(request)
    },
    init: ({ broadcast, subscribe }) => {
      // Reacting to any changes in configuration.
      subscribe(["UpdatedConfigEvent"], (event: UpdatedConfigEvent) => {
        emoji = "🆕"
      })

      // Updating the callback that is fired when there's a change in the
      // middleware configuration, such that it's broadcasted across the
      // entire server.
      broadcastEmojiUpdate = broadcast
    }
  }
}
```

## Shared utilities

There's a set of common tasks required by mulitple primitive packages, such as watching for file changes or memoizing expensive tasks. To avoid having to duplicate this logic across multiple packages, the `dev` package provides some of these methods that other packages can leverage.

```ts
import { watchDebounced } from "@netlify/dev"

watchDebounced("/some/directory", {
  onAdd: (paths: string[]) => {
    console.log("Some files have been added:", paths)
  },
  onChange: (paths: string[]) => {
    console.log("Some files have been changed:", paths)
  },
  onUnlinked: (paths: string[]) => {
    console.log("Some files have been deleted:", paths)
  }
})
```
