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

| Name                                                        | Description                                                             | Version                                                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🤖 [@netlify/ai](packages/ai)                               | TypeScript utilities for interacting with Netlify AI features           | [![version](https://npmx.dev/api/registry/badge/version/@netlify/ai?color=28b5ac)](https://npmx.dev/package/@netlify/ai)                               |
| 🔀 [@netlify/aws-lambda-compat](packages/aws-lambda-compat) | AWS Lambda compatibility wrapper for Netlify Functions                  | [![version](https://npmx.dev/api/registry/badge/version/@netlify/aws-lambda-compat?color=28b5ac)](https://npmx.dev/package/@netlify/aws-lambda-compat) |
| 🗄️ [@netlify/blobs](packages/blobs)                         | TypeScript client for Netlify Blobs                                     | [![version](https://npmx.dev/api/registry/badge/version/@netlify/blobs?color=28b5ac)](https://npmx.dev/package/@netlify/blobs)                         |
| 💾 [@netlify/cache](packages/cache)                         | TypeScript utilities for interacting with the Netlify cache             | [![version](https://npmx.dev/api/registry/badge/version/@netlify/cache?color=28b5ac)](https://npmx.dev/package/@netlify/cache)                         |
| 🗃️ [@netlify/database](packages/database)                   | TypeScript client for interacting with Netlify's managed database       | [![version](https://npmx.dev/api/registry/badge/version/@netlify/database?color=28b5ac)](https://npmx.dev/package/@netlify/database)                   |
| 🛠️ [@netlify/dev](packages/dev)                             | Emulation of the Netlify environment for local development              | [![version](https://npmx.dev/api/registry/badge/version/@netlify/dev?color=28b5ac)](https://npmx.dev/package/@netlify/dev)                             |
| 🔧 [@netlify/dev-utils](packages/dev-utils)                 | TypeScript utilities for the local emulation of the Netlify environment | [![version](https://npmx.dev/api/registry/badge/version/@netlify/dev-utils?color=28b5ac)](https://npmx.dev/package/@netlify/dev-utils)                 |
| 🌐 [@netlify/edge-functions](packages/edge-functions)       | TypeScript utilities for interacting with Netlify Edge Functions        | [![version](https://npmx.dev/api/registry/badge/version/@netlify/edge-functions?color=28b5ac)](https://npmx.dev/package/@netlify/edge-functions)       |
| ⚡ [@netlify/functions](packages/functions)                 | TypeScript utilities for interacting with Netlify Functions             | [![version](https://npmx.dev/api/registry/badge/version/@netlify/functions?color=28b5ac)](https://npmx.dev/package/@netlify/functions)                 |
| 📋 [@netlify/headers](packages/headers)                     | TypeScript implementation of Netlify's headers engine                   | [![version](https://npmx.dev/api/registry/badge/version/@netlify/headers?color=28b5ac)](https://npmx.dev/package/@netlify/headers)                     |
| 🔐 [@netlify/identity](packages/identity)                   | TypeScript utilities for interacting with Netlify Identity              | [![version](https://npmx.dev/api/registry/badge/version/@netlify/identity?color=28b5ac)](https://npmx.dev/package/@netlify/identity)                   |
| 🖼️ [@netlify/images](packages/images)                       | TypeScript utilities for interacting with Netlify Image CDN             | [![version](https://npmx.dev/api/registry/badge/version/@netlify/images?color=28b5ac)](https://npmx.dev/package/@netlify/images)                       |
| 🔍 [@netlify/otel](packages/otel)                           | TypeScript utilities to interact with Netlify's OpenTelemetry           | [![version](https://npmx.dev/api/registry/badge/version/@netlify/otel?color=28b5ac)](https://npmx.dev/package/@netlify/otel)                           |
| 🔄 [@netlify/redirects](packages/redirects)                 | TypeScript implementation of Netlify's rewrites and redirects engine    | [![version](https://npmx.dev/api/registry/badge/version/@netlify/redirects?color=28b5ac)](https://npmx.dev/package/@netlify/redirects)                 |
| 🏛️ [@netlify/runtime](packages/runtime)                     | Netlify compute runtime                                                 | [![version](https://npmx.dev/api/registry/badge/version/@netlify/runtime?color=28b5ac)](https://npmx.dev/package/@netlify/runtime)                     |
| 🔨 [@netlify/runtime-utils](packages/runtime-utils)         | Cross-environment utilities for the Netlify runtime                     | [![version](https://npmx.dev/api/registry/badge/version/@netlify/runtime-utils?color=28b5ac)](https://npmx.dev/package/@netlify/runtime-utils)         |
| 📁 [@netlify/static](packages/static)                       | TypeScript implementation of Netlify's static file serving logic        | [![version](https://npmx.dev/api/registry/badge/version/@netlify/static?color=28b5ac)](https://npmx.dev/package/@netlify/static)                       |
| 🔢 [@netlify/types](packages/types)                         | TypeScript types for Netlify platform primitives                        | [![version](https://npmx.dev/api/registry/badge/version/@netlify/types?color=28b5ac)](https://npmx.dev/package/@netlify/types)                         |
