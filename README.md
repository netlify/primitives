# Netlify Primitives

Implementation of different Netlify platform primitives. Includes both developer-facing utilities as well as the logic
required for the local emulation of each primitive to aid local development workflows.

## Installation

This monorepo uses [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces/).

Start by installing the dependencies:

```sh
npm install
```

You can then build all the packages:

```sh
npm run build --workspaces=true
```

When working on the packages, it can be helpful to have them rebuild on change:

```sh
npm run dev
```

## Packages

| Name                                                                          | Description                                                             | Version                                                                                                                                    |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 🤖 [@netlify/ai](packages/ai)                                                 | TypeScript utilities for interacting with Netlify AI features           | [![npm version](https://img.shields.io/npm/v/@netlify/ai.svg)](https://www.npmjs.com/package/@netlify/ai)                                  |
| 🔀 [@netlify/aws-lambda-compat](packages/aws-lambda-compat)                   | AWS Lambda compatibility wrapper for Netlify Functions                  | [![npm version](https://img.shields.io/npm/v/@netlify/aws-lambda-compat.svg)](https://www.npmjs.com/package/@netlify/aws-lambda-compat)    |
| 🗄️ [@netlify/blobs](packages/blobs)                                           | TypeScript client for Netlify Blobs                                     | [![npm version](https://img.shields.io/npm/v/@netlify/blobs.svg)](https://www.npmjs.com/package/@netlify/blobs)                            |
| 💾 [@netlify/cache](packages/cache)                                           | TypeScript utilities for interacting with the Netlify cache             | [![npm version](https://img.shields.io/npm/v/@netlify/cache.svg)](https://www.npmjs.com/package/@netlify/cache)                            |
| 🛠️ [@netlify/dev](packages/dev)                                               | Emulation of the Netlify environment for local development              | [![npm version](https://img.shields.io/npm/v/@netlify/dev.svg)](https://www.npmjs.com/package/@netlify/dev)                                |
| 🔧 [@netlify/dev-utils](packages/dev-utils)                                   | TypeScript utilities for the local emulation of the Netlify environment | [![npm version](https://img.shields.io/npm/v/@netlify/dev-utils.svg)](https://www.npmjs.com/package/@netlify/dev-utils)                    |
| ⚡ [@netlify/functions](packages/functions)                                   | TypeScript utilities for interacting with Netlify Functions             | [![npm version](https://img.shields.io/npm/v/@netlify/functions.svg)](https://www.npmjs.com/package/@netlify/functions)                    |
| 📋 [@netlify/headers](packages/headers)                                       | TypeScript implementation of Netlify's headers engine                   | [![npm version](https://img.shields.io/npm/v/@netlify/headers.svg)](https://www.npmjs.com/package/@netlify/headers)                        |
| 🖼️ [@netlify/images](packages/images)                                         | TypeScript utilities for interacting with Netlify Image CDN             | [![npm version](https://img.shields.io/npm/v/@netlify/images.svg)](https://www.npmjs.com/package/@netlify/images)                          |
| 🚀 [@netlify/nuxt](packages/nuxt-module)                                      | Nuxt module with a local emulation of the Netlify environment           | [![npm version](https://img.shields.io/npm/v/@netlify/nuxt.svg)](https://www.npmjs.com/package/@netlify/nuxt)                              |
| 🔍 [@netlify/otel](packages/otel)                                             | TypeScript utilities to interact with Netlify's OpenTelemetry           | [![npm version](https://img.shields.io/npm/v/@netlify/otel.svg)](https://www.npmjs.com/package/@netlify/otel)                              |
| 🔄 [@netlify/redirects](packages/redirects)                                   | TypeScript implementation of Netlify's rewrites and redirects engine    | [![npm version](https://img.shields.io/npm/v/@netlify/redirects.svg)](https://www.npmjs.com/package/@netlify/redirects)                    |
| 🏛️ [@netlify/runtime](packages/runtime)                                       | Netlify compute runtime                                                 | [![npm version](https://img.shields.io/npm/v/@netlify/runtime.svg)](https://www.npmjs.com/package/@netlify/runtime)                        |
| 🔨 [@netlify/runtime-utils](packages/runtime-utils)                           | Cross-environment utilities for the Netlify runtime                     | [![npm version](https://img.shields.io/npm/v/@netlify/runtime-utils.svg)](https://www.npmjs.com/package/@netlify/runtime-utils)            |
| 📁 [@netlify/static](packages/static)                                         | TypeScript implementation of Netlify's static file serving logic        | [![npm version](https://img.shields.io/npm/v/@netlify/static.svg)](https://www.npmjs.com/package/@netlify/static)                          |
| 🔢 [@netlify/types](packages/types)                                           | TypeScript types for Netlify platform primitives                        | [![npm version](https://img.shields.io/npm/v/@netlify/types.svg)](https://www.npmjs.com/package/@netlify/types)                            |
| 🔌 [@netlify/vite-plugin](packages/vite-plugin)                               | Vite plugin with a local emulation of the Netlify environment           | [![npm version](https://img.shields.io/npm/v/@netlify/vite-plugin.svg)](https://www.npmjs.com/package/@netlify/vite-plugin)                |
| 🔌 [@netlify/vite-plugin-tanstack-start](packages/vite-plugin-tanstack-start) | Vite plugin for TanStack Start on Netlify                               | [![npm version](https://img.shields.io/npm/v/@netlify/vite-plugin.svg)](https://www.npmjs.com/package/@netlify/vite-plugin-tanstack-start) |
