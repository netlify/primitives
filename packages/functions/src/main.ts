import type { NetlifyGlobal } from '@netlify/types'

declare global {
  // Using `var` so that the declaration is hoisted in such a way that we can
  // reference it before it's initialized.

  var Netlify: NetlifyGlobal
}

export { builder } from './lib/builder.js'
export { purgeCache } from './lib/purge_cache.js'
export { schedule } from './lib/schedule.js'
export { stream } from './lib/stream.js'
export * from './function/index.js'
