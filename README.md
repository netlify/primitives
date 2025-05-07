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

### 🗄️ [@netlify/blobs](packages/blobs)

TypeScript client for Netlify Blobs

### 🛠️ [@netlify/dev](packages/dev)

Emulation of the Netlify environment for local development

### 🔧 [@netlify/dev-utils](packages/dev-utils)

TypeScript utilities for the local emulation of the Netlify environment

### ⚡ [@netlify/functions](packages/functions)

TypeScript utilities for interacting with Netlify Functions

### 🔄 [@netlify/redirects](packages/redirects)

TypeScript implementation of Netlify's rewrites and redirects engine

### 📁 [@netlify/static](packages/static)

TypeScript implementation of Netlify's static file serving logic

### 🔌 [@netlify/vite-plugin](packages/vite-plugin)

Vite plugin with a local emulation of the Netlify environment
