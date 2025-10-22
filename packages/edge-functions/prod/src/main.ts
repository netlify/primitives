import type { NetlifyGlobal } from '@netlify/types'

declare global {
  // Using `var` instead of `const` to allow TypeScript declaration merging.
  // Multiple packages can declare the same global with `var`, but `const` cannot be redeclared.
  var Netlify: NetlifyGlobal
}

export type { Context, Cookie } from '@netlify/types'
export type { Config, IntegrationsConfig, Manifest, ManifestFunction } from './lib/config.js'
export type { EdgeFunction } from './lib/edge-function.js'
