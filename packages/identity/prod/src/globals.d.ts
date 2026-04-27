import type { NetlifyCookies } from './types.js'
import type { IdentityUser } from './user.js'

interface NetlifyIdentityContext {
  url?: string
  token?: string
  user?: IdentityUser
}

declare global {
  var netlifyIdentityContext: NetlifyIdentityContext | undefined
  var Netlify: { context?: { url?: string; cookies?: NetlifyCookies } } | undefined
}

export {}
