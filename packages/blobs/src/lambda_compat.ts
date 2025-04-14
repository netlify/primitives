import { EnvironmentContext, setEnvironmentContext } from './environment.ts'
import type { LambdaEvent } from './types.ts'
import { base64Decode } from './util.ts'

interface BlobsEventData {
  token: string
  url: string
}

export const connectLambda = (event: LambdaEvent) => {
  const rawData = base64Decode(event.blobs)
  const data = JSON.parse(rawData) as BlobsEventData
  const environmentContext: EnvironmentContext = {
    deployID: event.headers['x-nf-deploy-id'],
    edgeURL: data.url,
    siteID: event.headers['x-nf-site-id'],
    token: data.token,
  }

  setEnvironmentContext(environmentContext)
}
