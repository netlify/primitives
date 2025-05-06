# @netlify/dev

> [!WARNING] This module is under active development and does **not** yet support all Netlify platform features.

`@netlify/dev` is a local emulator for the Netlify production environment. While it can be used directly by advanced
users, it is primarily designed as a foundational library for higher-level tools like the
[Netlify CLI](https://docs.netlify.com/cli/get-started/) and the
[Netlify Vite Plugin](https://docs.netlify.com/integrations/vite/overview/).

It provides a local request pipeline that mimics the Netlify platform’s request handling, including support for
Functions, Blobs, Static files, and Redirects.

## 🚧 Feature Support

| Feature                | Supported |
| ---------------------- | --------- |
| Functions              | ✅ Yes    |
| Edge Functions         | ❌ No     |
| Blobs                  | ✅ Yes    |
| Cache API              | ✅ Yes    |
| Redirects and Rewrites | ✅ Yes    |
| Headers                | ❌ No     |
| Environment Variables  | ❌ No     |

> Note: Missing features will be added incrementally. This module is **not** intended to be a full replacement for the
> Netlify CLI.

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
  functions: { enabled: true },
  blobs: { enabled: true },
  redirects: { enabled: true },
  staticFiles: { enabled: true },
})

await devServer.start()

const response = await devServer.handle(new Request('http://localhost:8888/path'))

console.log(await response.text())

await devServer.stop()
```

## 🧪 Contributing and feedback

This module is **experimental**, and we welcome feedback and contributions. Feel free to open issues or pull requests if
you encounter bugs or have suggestions.
