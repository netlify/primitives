import path from 'node:path'
import process from 'node:process'

import { BlobsServer } from '@netlify/blobs/server'
import { startRuntime } from '@netlify/runtime'
import type { NetlifyGlobal } from '@netlify/types'

interface GetRuntimeOptions {
  blobs: boolean
  blobsToken?: string
  deployID: string
  projectRoot: string
  siteID: string
}

const restoreEnvironment = (snapshot: Record<string, string | undefined>) => {
  for (const key in snapshot) {
    if (snapshot[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = snapshot[key]
    }
  }
}

export const getRuntime = async ({ blobs, deployID, projectRoot, siteID }: GetRuntimeOptions) => {
  const blobsToken = Math.random().toString().slice(2)
  const blobsServer = blobs
    ? new BlobsServer({
        directory: path.join(projectRoot, '.netlify', 'blobs-serve'),
        token: blobsToken,
      })
    : null
  const blobsServerDetails = await blobsServer?.start()

  const envSnapshot: Record<string, string | undefined> = {}
  const env: NetlifyGlobal['env'] = {
    delete: (key: string) => {
      envSnapshot[key] = envSnapshot[key] || process.env[key]

      delete process.env[key]
    },
    get: (key: string) => process.env[key],
    has: (key: string) => Boolean(process.env[key]),
    set: (key: string, value: string) => {
      envSnapshot[key] = envSnapshot[key] || process.env[key]

      process.env[key] = value
    },
    toObject: () => process.env as Record<string, string>,
  }

  startRuntime({
    blobs: blobsServerDetails
      ? {
          edgeURL: `http://localhost:${blobsServerDetails.port}`,
          uncachedEdgeURL: `http://localhost:${blobsServerDetails.port}`,
          primaryRegion: 'us-east-2',
          token: blobsToken,
        }
      : undefined,
    cache: {
      getCacheAPIContext: () => null,
      purgeToken: '',
    },
    deployID,
    env,
    getRequestContext: () => null,
    siteID,
  })

  return {
    env,
    envSnapshot,
    stop: async () => {
      restoreEnvironment(envSnapshot)

      await blobsServer?.stop()
    },
  }
}
