import { base64Decode, getEnvironment } from '@netlify/runtime-utils'

declare global {
  // Using `var` so that the declaration is hoisted in such a way that we can
  // reference it before it's initialized.

  var netlifySandboxContext: unknown
}

export interface EnvironmentContext {
  apiURL?: string
  siteID?: string
  token?: string
}

export const getEnvironmentContext = (): EnvironmentContext => {
  const context = globalThis.netlifySandboxContext ?? getEnvironment().get('NETLIFY_SANDBOX_CONTEXT')

  if (typeof context !== 'string' || !context) {
    return {}
  }

  try {
    return JSON.parse(base64Decode(context)) as EnvironmentContext
  } catch {
    return {}
  }
}

export type ResolveContext = () => Required<EnvironmentContext>
