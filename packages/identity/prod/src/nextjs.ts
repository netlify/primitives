// Minimal declaration so we can use require() without @types/node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: ((id: string) => any) | undefined

/**
 * Calls `headers()` from `next/headers` if available, to opt Next.js RSC
 * routes into dynamic rendering. Without this, Next.js may statically
 * optimize pages that call functions in this package, caching the build-time result.
 *
 * Re-throws DynamicServerError so Next.js can catch it and switch to
 * dynamic rendering. Silently ignores if not in a Next.js environment.
 */
let nextHeadersFn: (() => unknown) | null | undefined
export const triggerNextjsDynamic = (): void => {
  if (nextHeadersFn === null) return

  if (nextHeadersFn === undefined) {
    try {
      if (typeof require === 'undefined') {
        nextHeadersFn = null
        return
      }
      const mod = require('next/headers')
      nextHeadersFn = mod.headers
    } catch {
      nextHeadersFn = null
      return
    }
  }

  const fn = nextHeadersFn
  if (!fn) return

  try {
    fn()
  } catch (e: unknown) {
    // Re-throw DynamicServerError so Next.js can opt into dynamic rendering.
    // These errors have a `digest` property containing 'DYNAMIC_SERVER_USAGE'
    // or a message about bailing out of prerendering.
    if (e instanceof Error && ('digest' in e || /bail\s*out.*prerende/i.test(e.message))) {
      throw e
    }
  }
}

/** Reset cached state and optionally inject a headers function. Test use only. */
export const resetNextjsState = (headersFn?: (() => unknown) | null): void => {
  nextHeadersFn = headersFn === null ? null : (headersFn ?? undefined)
}
