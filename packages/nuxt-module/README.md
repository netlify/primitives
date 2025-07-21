# Netlify 🤝 Nuxt

[![npm version][npm-version-src]][npm-version-href] [![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

`@netlify/nuxt` provides local emulation of the Netlify platform directly in `nuxt dev`

## Features

This repackages all the same features as `@netlify/vite-plugin`.
[Check out its docs for details](/packages/vite-plugin/README.md).

## Quick Setup

Install the module to your Nuxt application with one command:

```bash
npx nuxi module add @netlify/nuxt
```

That's it! You now have local emulation of the full Netlify platform automatically in your nuxt dev server:

```bash
npx nuxt dev
```

## Contribution

<details>
  <summary>Local development</summary>

```bash
# Install dependencies
npm install

# Generate type stubs
npm run dev:prepare

# Develop with the playground
npm run dev

# Build the playground
npm run dev:build

# Run ESLint
npm run lint

# Run Vitest
npm run test
npm run test:watch
```

</details>

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/@netlify/nuxt/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/@netlify/nuxt
[npm-downloads-src]: https://img.shields.io/npm/dm/@netlify/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/@netlify/nuxt
[license-src]: https://img.shields.io/npm/l/@netlify/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/@netlify/nuxt
[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
