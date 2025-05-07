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
npm run build -ws
```

## Packages

| Name                                            | Description                                                             | Version                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 🗄️ [@netlify/blobs](packages/blobs)             | TypeScript client for Netlify Blobs                                     | [![npm version](https://img.shields.io/npm/v/@netlify/blobs.svg)](https://www.npmjs.com/package/@netlify/blobs)             |
| 🛠️ [@netlify/dev](packages/dev)                 | Emulation of the Netlify environment for local development              | [![npm version](https://img.shields.io/npm/v/@netlify/dev.svg)](https://www.npmjs.com/package/@netlify/dev)                 |
| 🔧 [@netlify/dev-utils](packages/dev-utils)     | TypeScript utilities for the local emulation of the Netlify environment | [![npm version](https://img.shields.io/npm/v/@netlify/dev-utils.svg)](https://www.npmjs.com/package/@netlify/dev-utils)     |
| ⚡ [@netlify/functions](packages/functions)     | TypeScript utilities for interacting with Netlify Functions             | [![npm version](https://img.shields.io/npm/v/@netlify/functions.svg)](https://www.npmjs.com/package/@netlify/functions)     |
| 🔄 [@netlify/redirects](packages/redirects)     | TypeScript implementation of Netlify's rewrites and redirects engine    | [![npm version](https://img.shields.io/npm/v/@netlify/redirects.svg)](https://www.npmjs.com/package/@netlify/redirects)     |
| 📁 [@netlify/static](packages/static)           | TypeScript implementation of Netlify's static file serving logic        | [![npm version](https://img.shields.io/npm/v/@netlify/static.svg)](https://www.npmjs.com/package/@netlify/static)           |
| 🔌 [@netlify/vite-plugin](packages/vite-plugin) | Vite plugin with a local emulation of the Netlify environment           | [![npm version](https://img.shields.io/npm/v/@netlify/vite-plugin.svg)](https://www.npmjs.com/package/@netlify/vite-plugin) |
