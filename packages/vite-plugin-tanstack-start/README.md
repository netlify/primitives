# @netlify/vite-plugin-tanstack-start

This Vite plugin configures your TanStack Start app for **deployment** to Netlify and provides full local emulation of
the Netlify platform directly in `vite dev`.

## Features

- Configures `vite build` to prepare your app's production build for deployment to Netlify
  - See
    [full TanStack Start deployment docs for more](https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start/#deploy-to-netlify)
- Configures `vite dev` to behave just like the production Netlify platform, but locally on your machine
  - This has all the same features as `@netlify/vite-plugin`.
    [Check out its docs for details](/packages/vite-plugin/README.md).

## Installation

```bash
npm install -D @netlify/vite-plugin-tanstack-start
```

## Configuration options

The plugin accepts the following options:

```typescript
{
  edgeSSR: boolean, // Deploy your app to Netlify Edge Functions (default: false)
}
```

## Usage

Add the plugin to your `vite.config.js` or `vite.config.ts`:

```js
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import netlify from '@netlify/vite-plugin-tanstack-start'

export default defineConfig({
  plugins: [tanstackStart(), react(), netlify()],
})
```
