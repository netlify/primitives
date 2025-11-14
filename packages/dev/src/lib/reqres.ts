import { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'

export const normalizeHeaders = (request: IncomingMessage) => {
  const result: [string, string][] = []
  let headers = request.headers

  // Handle HTTP/2 pseudo-headers: https://www.rfc-editor.org/rfc/rfc9113.html#name-request-pseudo-header-field
  // In certain versions of Node.js, the built-in `Request` constructor from undici throws
  // if a header starts with a colon.
  if (request.httpVersionMajor >= 2) {
    headers = { ...headers }
    delete headers[':authority']
    delete headers[':method']
    delete headers[':path']
    delete headers[':scheme']
  }

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      result.push([key, value.join(',')])
    } else if (typeof value === 'string') {
      result.push([key, value])
    }
  }

  return result
}

export const getNormalizedRequest = (input: Request, requestID: string, removeBody?: boolean) => {
  const method = input.method.toUpperCase()
  const headers = input.headers
  headers.set('x-nf-request-id', requestID)

  return new Request(input.url, {
    body: method === 'GET' || method === 'HEAD' || removeBody ? null : input.body,
    // @ts-expect-error Not typed!
    duplex: 'half',
    headers,
    method,
  })
}

export const getNormalizedRequestFromNodeRequest = (
  input: IncomingMessage,
  requestID: string,
  removeBody?: boolean,
) => {
  const { headers, url = '' } = input
  const origin = `http://${headers.host ?? 'localhost'}`
  const fullUrl = new URL(url, origin)
  const method = input.method?.toUpperCase() ?? 'GET'
  const body =
    input.method === 'GET' || input.method === 'HEAD' || removeBody
      ? null
      : (Readable.toWeb(input) as unknown as ReadableStream<unknown>)

  const normalizedHeaders = normalizeHeaders(input)
  normalizedHeaders.push(['x-nf-request-id', requestID])

  return new Request(fullUrl, {
    body,
    // @ts-expect-error Not typed!
    duplex: 'half',
    headers: normalizedHeaders,
    method,
  })
}
