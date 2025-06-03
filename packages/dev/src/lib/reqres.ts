import { IncomingHttpHeaders, IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'

export const normalizeHeaders = (headers: IncomingHttpHeaders): HeadersInit => {
  const result: [string, string][] = []

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

  return new Request(fullUrl, {
    body,
    // @ts-expect-error Not typed!
    duplex: 'half',
    headers: normalizeHeaders({ ...input.headers, 'x-nf-request-id': requestID }),
    method,
  })
}
