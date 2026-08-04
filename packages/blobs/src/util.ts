import process from 'node:process'
import { getTracer, withActiveSpan } from '@netlify/otel'
import type { Span } from '@netlify/otel/opentelemetry'

import { NF_ERROR, NF_REQUEST_ID } from './headers.ts'

export const DEPLOY_STORE_PREFIX = 'deploy:'
export const SITE_STORE_PREFIX = 'site:'

interface BlobsErrorContext {
  method?: string
  storeName?: string
}

const isDeniedWrite = (res: Response, { method, storeName }: BlobsErrorContext) =>
  (res.status === 401 || res.status === 403) &&
  (method === 'put' || method === 'delete') &&
  storeName !== undefined &&
  !storeName.startsWith(DEPLOY_STORE_PREFIX)

const blobsErrorMessage = (res: Response, context: BlobsErrorContext) => {
  let details = res.headers.get(NF_ERROR) || `${res.status} status code`

  if (res.headers.has(NF_REQUEST_ID)) {
    details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`
  }

  if (isDeniedWrite(res, context)) {
    const storeName = context.storeName?.startsWith(SITE_STORE_PREFIX)
      ? context.storeName.slice(SITE_STORE_PREFIX.length)
      : context.storeName

    return `Netlify Blobs could not write to store '${storeName}' (${details}). Builds and build plugins can only write to deploy-specific stores: use 'getDeployStore' instead of 'getStore', or pass a 'token' with write access to the store. If this code is not running in a build, check that the token and site ID are valid. See https://docs.netlify.com/build/data-and-storage/netlify-blobs/#deploy-specific-stores`
  }

  return `Netlify Blobs has generated an internal error (${details})`
}

export class BlobsInternalError extends Error {
  constructor(res: Response, context: BlobsErrorContext = {}) {
    super(blobsErrorMessage(res, context))

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

function percentEncode(str: string): string {
  return str.replace(/./, (char) => {
    return '%' + char.charCodeAt(0).toString(16).padStart(2, '0')
  })
}

const invalidWin32File = /^(CON|COM[1-9]|LPT[1-9]|NUL|PRN|AUX)$/i

/*
 *  On Windows, file paths can't include some valid blob/store key characters, so we URI-encode them.  fixme: limitations
 *
 *  Limitations:
 *    - this doesn't deal with long names (blob keys can be 600 chars, default on windows is max 260)
 *  For keys (which we don't need to decode) maybe a hash would be a better idea
 */
export function encodeWin32SafeName(string: string): string {
  if (invalidWin32File.exec(string)) {
    return percentEncode(string)
  }
  return encodeURIComponent(string).replace(/([*]|[. ]$)/g, percentEncode)
}

// Names are URI-encoded on Windows, so we must decode them first.
export function decodeWin32SafeName(string: string): string {
  return decodeURIComponent(string)
}

export function encodeName(string: string): string {
  return process.platform == 'win32' ? encodeWin32SafeName(string) : string
}

export function decodeName(string: string): string {
  return process.platform == 'win32' ? decodeWin32SafeName(string) : string
}

// Allow users to pass in their own active span or defaults to creating a new active span
export function withSpan<F extends (span?: Span) => ReturnType<F>>(span: Span | undefined, name: string, fn: F) {
  if (span) return fn(span)

  return withActiveSpan(getTracer(), name, (span) => {
    return fn(span)
  })
}
