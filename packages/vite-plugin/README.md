# @netlify/vite-plugin

Vite plugin that emulates Netlify's platform features within your Vite dev server.

## Feature Support

| Feature                | Supported |
| ---------------------- | --------- |
| Functions              | ✅ Yes    |
| Edge Functions         | ✅ Yes    |
| Blobs                  | ✅ Yes    |
| Cache API              | ✅ Yes    |
| Redirects and Rewrites | ✅ Yes    |
| Headers                | ✅ Yes    |
| Environment Variables  | ✅ Yes    |
| Image CDN              | ✅ Yes    |

> This module is **not** intended to be a full replacement for the Netlify CLI.

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
- `environmentVariables`: Configure environment variable injection
  - `enabled` (boolean, default: `true`): Enable environment variable injection
  - `injectUserEnv` (boolean, default: `true`): Inject user-defined environment variables. When `false`, only platform
    environment variables (like `NETLIFY_LOCAL`, `CONTEXT`, `SITE_ID`) are injected, excluding user-defined variables
    from Netlify UI or config files
- `functions`: Configure serverless functions
- `headers`: Configure response headers
- `images`: Configure Image CDN functionality
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

### Environment Variables Configuration

By default, the plugin injects all environment variables including user-defined ones from your Netlify site. If you want
to only inject platform environment variables (useful for frameworks that manage their own environment variables):

```js
import { defineConfig } from 'vite'
import netlify from '@netlify/vite-plugin'

export default defineConfig({
  plugins: [
    netlify({
      environmentVariables: {
        enabled: true,
        injectUserEnv: false,
      },
    }),
  ],
})
```

With `injectUserEnv: false`, only platform variables like `NETLIFY_LOCAL`, `CONTEXT`, and `SITE_ID` are injected,
which are required for platform features like `purgeCache()` to work correctly.
