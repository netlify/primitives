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

export const getNormalizedRequest = (input: Request | IncomingMessage, requestID: string, removeBody?: boolean) => {
  if (input instanceof Request) {
    const headers = input.headers
    headers.set('x-nf-request-id', requestID)

    return new Request(input.url, {
      body: removeBody ? null : input.body,
      headers,
      method: input.method,
    })
  }

  const { method, headers, url = '' } = input
  const origin = `http://${headers.host ?? 'localhost'}`
  const fullUrl = new URL(url, origin)
  const body = removeBody ? null : (Readable.toWeb(input) as unknown as ReadableStream<unknown>)

  return new Request(fullUrl, {
    body,
    headers: normalizeHeaders({ ...input.headers, 'x-nf-request-id': requestID }),
    method: method ?? 'get',
  })
}
