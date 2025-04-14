export type BlobInput = string | ArrayBuffer | Blob

export type Fetcher = typeof globalThis.fetch

export enum HTTPMethod {
  DELETE = 'delete',
  GET = 'get',
  HEAD = 'head',
  PUT = 'put',
}

// TODO: Import the full type from `@netlify/functions`.
export interface LambdaEvent {
  blobs: string
  headers: Record<string, string>
}
