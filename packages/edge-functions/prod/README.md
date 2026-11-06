# @netlify/edge-functions

[![@netlify/edge-functions version](https://npmx.dev/api/registry/badge/version/@netlify/edge-functions?color=28b5ac&name=true)](https://npmx.dev/package/@netlify/edge-functions)
[![license](https://npmx.dev/api/registry/badge/license/@netlify/edge-functions?color=28b5ac)](https://npmx.dev/package/@netlify/edge-functions)
[![node](https://npmx.dev/api/registry/badge/engines/@netlify/edge-functions?color=28b5ac)](https://npmx.dev/package/@netlify/edge-functions)
[![downloads/mo](https://npmx.dev/api/registry/badge/downloads/@netlify/edge-functions?color=28b5ac)](https://npmx.dev/package/@netlify/edge-functions)

TypeScript types for [Netlify Edge Functions](https://docs.netlify.com/build/edge-functions/overview/).

```shell
npm install @netlify/edge-functions
```

```ts
import type { Config, Context } from '@netlify/edge-functions'

export default async (req: Request, context: Context) => {
  return new Response(`Hello from ${context.geo.city}`)
}

export const config: Config = { path: '/hello' }
```
