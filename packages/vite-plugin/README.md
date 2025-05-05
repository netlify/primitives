# @netlify/vite-plugin

> [!WARNING] This is an experimental Vite plugin for Netlify. It is under active development and does **not** yet support all Netlify platform features.

A Vite plugin that integrates with Netlify's platform features.

## Installation

```bash
npm install @netlify/vite-plugin
```

## Configuration options

The plugin accepts the following options:

- `middleware` (boolean, default: `true`): Attach a Vite middleware that intercepts requests and handles them in the same way as the Netlify production environment
- `blobs`: Configure blob storage functionality
- `functions`: Configure serverless functions
- `redirects`: Configure URL redirects
- `staticFiles`: Configure static file serving

## Usage

Add the plugin to your `vite.config.js` or `vite.config.ts`:

```js
import { defineConfig } from 'vite'
import netlify from '@netlify/vite-plugin'

export default defineConfig({
  plugins: [netlify()]
})
```
