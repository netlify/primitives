import { Client, ClientOptions, getClientOptions } from './client.ts'
import { getEnvironmentContext, MissingBlobsEnvironmentError } from './environment.ts'
import { Region, REGION_AUTO } from './region.ts'
import { Store } from './store.ts'

export interface GetDeployStoreOptions extends Partial<ClientOptions> {
  deployID?: string
  name?: string
  region?: Region
}

/**
 * Gets a reference to a deploy-scoped store.
 */
export const getDeployStore = (input: GetDeployStoreOptions | string = {}): Store => {
  const context = getEnvironmentContext()
  const options = typeof input === 'string' ? { name: input } : input
  const deployID = options.deployID ?? context.deployID

  if (!deployID) {
    throw new MissingBlobsEnvironmentError(['deployID'])
  }

  const clientOptions = getClientOptions(options, context)

  if (!clientOptions.region) {
    // If a region hasn't been supplied and we're dealing with an edge request,
    // use the region from the context if one is defined, otherwise throw.
    if (clientOptions.edgeURL || clientOptions.uncachedEdgeURL) {
      // eslint-disable-next-line max-depth
      if (!context.primaryRegion) {
        throw new Error(
          'When accessing a deploy store, the Netlify Blobs client needs to be configured with a region, and one was not found in the environment. To manually set the region, set the `region` property in the `getDeployStore` options. If you are using the Netlify CLI, you may have an outdated version; run `npm install -g netlify-cli@latest` to update and try again.',
        )
      }

      clientOptions.region = context.primaryRegion
    } else {
      // For API requests, we can use `auto` and let the API choose the right
      // region.
      clientOptions.region = REGION_AUTO
    }
  }

  const client = new Client(clientOptions)

  return new Store({ client, deployID, name: options.name })
}

export interface GetStoreOptions extends Partial<ClientOptions> {
  deployID?: string
  name?: string
}

/**
 * Gets a reference to a store.
 *
 * @param input Either a string containing the store name or an options object
 */
export const getStore: {
  (name: string): Store
  (options: GetStoreOptions): Store
} = (input) => {
  if (typeof input === 'string') {
    const clientOptions = getClientOptions({})
    const client = new Client(clientOptions)

    return new Store({ client, name: input })
  }

  if (typeof input?.name === 'string') {
    const { name } = input
    const clientOptions = getClientOptions(input)

    if (!name) {
      throw new MissingBlobsEnvironmentError(['name'])
    }

    const client = new Client(clientOptions)

    return new Store({ client, name })
  }

  if (typeof input?.deployID === 'string') {
    const clientOptions = getClientOptions(input)
    const { deployID } = input

    if (!deployID) {
      throw new MissingBlobsEnvironmentError(['deployID'])
    }

    const client = new Client(clientOptions)

    return new Store({ client, deployID })
  }

  throw new Error(
    'The `getStore` method requires the name of the store as a string or as the `name` property of an options object',
  )
}
