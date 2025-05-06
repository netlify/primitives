import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'

const normalizeHeaders = (headers: IncomingHttpHeaders): HeadersInit => {
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

export const toWebRequest = (nodeReq: IncomingMessage, urlPath?: string) => {
  const { method, headers, url = '' } = nodeReq
  const ac = new AbortController()
  const origin = `http://${headers.host}`
  const fullUrl = new URL(urlPath ?? url, origin)
  const webStream = Readable.toWeb(nodeReq) as unknown as ReadableStream<any>

  nodeReq.once('aborted', () => ac.abort())

  return new Request(fullUrl.href, {
    method,
    headers: normalizeHeaders(headers),
    body: method === 'GET' || method === 'HEAD' ? null : webStream,
    // @ts-expect-error Not typed
    duplex: 'half',
  })
}

export const fromWebResponse = async (webRes: Response, res: ServerResponse) => {
  res.statusCode = webRes.status
  webRes.headers.forEach((value, name) => {
    res.setHeader(name, value)
  })

  if (webRes.body) {
    const reader = webRes.body.getReader()
    const writer = res

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      writer.write(value)
    }
  }

  res.end()
}
