export type ConsistencyMode = 'eventual' | 'strong'

export class BlobsConsistencyError extends Error {
  constructor() {
    super(
      `Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`,
    )

    this.name = 'BlobsConsistencyError'
  }
}
