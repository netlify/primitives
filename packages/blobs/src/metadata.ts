import { base64Decode, base64Encode } from './util.ts'

export type Metadata = Record<string, unknown>

const BASE64_PREFIX = 'b64;'
export const METADATA_HEADER_INTERNAL = 'x-amz-meta-user'
export const METADATA_HEADER_EXTERNAL = 'netlify-blobs-metadata'
const METADATA_MAX_SIZE = 2 * 1024

export const encodeMetadata = (metadata?: Metadata) => {
  if (!metadata) {
    return null
  }

  const encodedObject = base64Encode(JSON.stringify(metadata))
  const payload = `b64;${encodedObject}`

  if (METADATA_HEADER_EXTERNAL.length + payload.length > METADATA_MAX_SIZE) {
    throw new Error('Metadata object exceeds the maximum size')
  }

  return payload
}

export const decodeMetadata = (header: string | null): Metadata => {
  if (!header || !header.startsWith(BASE64_PREFIX)) {
    return {}
  }

  const encodedData = header.slice(BASE64_PREFIX.length)
  const decodedData = base64Decode(encodedData)
  const metadata = JSON.parse(decodedData)

  return metadata
}

export const getMetadataFromResponse = (response: Response) => {
  if (!response.headers) {
    return {}
  }

  // If metadata is coming from the API, it will be under the external header.
  // If it's coming from the edge, it will be under the internal header.
  const value = response.headers.get(METADATA_HEADER_EXTERNAL) || response.headers.get(METADATA_HEADER_INTERNAL)

  try {
    return decodeMetadata(value)
  } catch {
    throw new Error(
      'An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client.',
    )
  }
}
