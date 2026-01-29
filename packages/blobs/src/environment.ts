import { base64Decode, base64Encode, getEnvironment } from '@netlify/runtime-utils'

declare global {
  // Using `var` so that the declaration is hoisted in such a way that we can
  // reference it before it's initialized.

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
