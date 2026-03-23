import type { HandlerResponse } from './handler_response.js'

export function buildResponseFromResult(result: HandlerResponse): Response {
  const headers = new Headers()

  if (result.headers) {
    for (const [name, value] of Object.entries(result.headers)) {
      headers.set(name.toLowerCase(), value.toString())
    }
  }

  if (result.multiValueHeaders) {
    for (const [name, values] of Object.entries(result.multiValueHeaders)) {
      for (const value of values) {
        headers.append(name.toLowerCase(), value.toString())
      }
    }
  }

  let body: BodyInit | null = null

  if (result.body != null) {
    if (result.isBase64Encoded) {
      const binaryString = atob(result.body)
      const bytes = new Uint8Array(binaryString.length)

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      body = bytes
    } else {
      body = result.body
    }
  }

  return new Response(body, {
    status: result.statusCode,
    headers,
  })
}
