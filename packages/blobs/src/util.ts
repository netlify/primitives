import { NF_ERROR, NF_REQUEST_ID } from './headers.ts'

export class BlobsInternalError extends Error {
  constructor(res: Response) {
    let details = res.headers.get(NF_ERROR) || `${res.status} status code`

    if (res.headers.has(NF_REQUEST_ID)) {
      details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`
    }

    super(`Netlify Blobs has generated an internal error (${details})`)

    this.name = 'BlobsInternalError'
  }
}

export const collectIterator = async <T>(iterator: AsyncIterable<T>): Promise<T[]> => {
  const result: T[] = []

  for await (const item of iterator) {
    result.push(item)
  }

  return result
}

export const isNodeError = (error: unknown): error is NodeJS.ErrnoException => error instanceof Error

export type Logger = (...message: unknown[]) => void
