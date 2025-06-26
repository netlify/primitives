import process from 'node:process'
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
