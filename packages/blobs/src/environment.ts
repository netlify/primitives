import { base64Decode, base64Encode } from './util.ts'

interface EnvironmentVariables {
  delete: (key: string) => void
  get: (key: string) => string | undefined
  has: (key: string) => boolean
  set: (key: string, value: string) => void
  toObject: () => Record<string, string>
}

interface Globals {
  Deno?: {
    env: EnvironmentVariables
  }
  Netlify?: {
    env: EnvironmentVariables
  }
  process?: {
    env: Record<string, string>
  }
}

/**
 * Returns a cross-runtime interface for handling environment variables. It
 * uses the `Netlify.env` global if available, otherwise looks for `Deno.env`
 * and `process.env`.
 */
export const getEnvironment = (): EnvironmentVariables => {
  const { Deno, Netlify, process } = globalThis as Globals

  return (
    Netlify?.env ??
    Deno?.env ?? {
      delete: (key: string) => delete process?.env[key],
      get: (key: string) => process?.env[key],
      has: (key: string) => Boolean(process?.env[key]),
      set: (key: string, value: string) => {
        if (process?.env) {
          process.env[key] = value
        }
      },
      toObject: () => process?.env ?? {},
    }
  )
}

declare global {
  // Using `var` so that the declaration is hoisted in such a way that we can
  // reference it before it's initialized.
  // eslint-disable-next-line no-var
  var netlifyBlobsContext: unknown
}

/**
 * The context object that we expect in the environment.
 */
export interface EnvironmentContext {
  apiURL?: string
  deployID?: string
  edgeURL?: string
  primaryRegion?: string
  siteID?: string
  token?: string
  uncachedEdgeURL?: string
}

export const getEnvironmentContext = (): EnvironmentContext => {
  const context = globalThis.netlifyBlobsContext || getEnvironment().get('NETLIFY_BLOBS_CONTEXT')

  if (typeof context !== 'string' || !context) {
    return {}
  }

  const data = base64Decode(context)

  try {
    return JSON.parse(data) as EnvironmentContext
  } catch {
    // no-op
  }

  return {}
}

export const setEnvironmentContext = (context: EnvironmentContext) => {
  const encodedContext = base64Encode(JSON.stringify(context))

  getEnvironment().set('NETLIFY_BLOBS_CONTEXT', encodedContext)
}

export class MissingBlobsEnvironmentError extends Error {
  constructor(requiredProperties: string[]) {
    super(
      `The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: ${requiredProperties.join(
        ', ',
      )}`,
    )

    this.name = 'MissingBlobsEnvironmentError'
  }
}
