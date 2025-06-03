# @netlify/vite-plugin

> [!WARNING] This is an experimental Vite plugin for Netlify. It is under active development and does **not** yet
> support all Netlify platform features.

A Vite plugin that integrates with Netlify's platform features.

## 🚧 Feature Support

| Feature                | Supported |
| ---------------------- | --------- |
| Functions              | ✅ Yes    |
| Edge Functions         | ✅ Yes    |
| Blobs                  | ✅ Yes    |
| Cache API              | ✅ Yes    |
| Redirects and Rewrites | ✅ Yes    |
| Headers                | ✅ Yes    |
| Environment Variables  | ✅ Yes    |
| Image CDN              | ❌ No     |

> Note: Missing features will be added incrementally. This module is **not** intended to be a full replacement for the
> Netlify CLI.

## Installation

```bash
npm install @netlify/vite-plugin
```

## Configuration options

The plugin accepts the following options:

- `middleware` (boolean, default: `true`): Attach a Vite middleware that intercepts requests and handles them in the
  same way as the Netlify production environment
- `blobs`: Configure blob storage functionality
- `edgeFunctions`: Configure edge functions
- `functions`: Configure serverless functions
- `headers`: Configure response headers
- `redirects`: Configure URL redirects
- `staticFiles`: Configure static file serving

## Usage

Add the plugin to your `vite.config.js` or `vite.config.ts`:

```js
import { defineConfig } from 'vite'
import netlify from '@netlify/vite-plugin'

export default defineConfig({
  plugins: [netlify()],
})
```
