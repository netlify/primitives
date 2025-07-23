# @netlify/dev

`@netlify/dev` is a local emulator for the Netlify production environment. While it can be used directly by advanced
users, it is primarily designed as a foundational library for higher-level tools like the
[Netlify CLI](https://docs.netlify.com/cli/get-started/) and the
[Netlify Vite Plugin](https://docs.netlify.com/integrations/vite/overview/).

It provides a local request pipeline that mimics the Netlify platform’s request handling, including support for
Functions, Blobs, Static files, Redirects, and Image CDN.

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

## 🧪 Contributing and feedback

This module is **experimental**, and we welcome feedback and contributions. Feel free to open issues or pull requests if
you encounter bugs or have suggestions.
