import type { NetlifyGlobal } from '@netlify/types'

declare global {
  // Using `var` instead of `const` to allow TypeScript declaration merging.
  // Multiple packages can declare the same global with `var`, but `const` cannot be redeclared.
  var Netlify: NetlifyGlobal
}

export { builder } from './lib/builder.js'
export { purgeCache } from './lib/purge_cache.js'
export { schedule } from './lib/schedule.js'
export { stream } from './lib/stream.js'
export { SYNCHRONOUS_FUNCTION_TIMEOUT, BACKGROUND_FUNCTION_TIMEOUT } from './lib/consts.js'
export * from './function/index.js'
