import type { NetlifyGlobal } from '@netlify/types'

declare global {
  // Using `var` so that the declaration is hoisted in such a way that we can
  // reference it before it's initialized.
  // eslint-disable-next-line no-var
  var Netlify: NetlifyGlobal
}

export type { Context, Cookie } from '@netlify/types'
export type { Config, IntegrationsConfig, Manifest, ManifestFunction } from './lib/config.js'
export type { EdgeFunction } from './lib/edge-function.js'
