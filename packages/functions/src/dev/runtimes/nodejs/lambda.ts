import { shouldBase64Encode } from '@netlify/dev'
import { HandlerEvent } from '../../../function/handler_event.js'
import { HandlerResponse } from '../../../function/handler_response.js'

export const headersObjectFromWebHeaders = (webHeaders: Headers) => {
  const headers: Record<string, string> = {}
  const multiValueHeaders: Record<string, string[]> = {}

  webHeaders.forEach((value, key) => {
    headers[key] = value
    multiValueHeaders[key] = value.split(',').map((value) => value.trim())
  })

  return {
    headers,
    multiValueHeaders,
  }
}

export const webHeadersFromHeadersObject = (headersObject: HandlerResponse['headers']) => {
  const headers = new Headers()

  Object.entries(headersObject ?? {}).forEach(([name, value]) => {
    if (value !== undefined) {
      headers.set(name.toLowerCase(), value.toString())
    }
  })

  return headers
}

export const lambdaEventFromWebRequest = async (request: Request): Promise<HandlerEvent> => {
  const url = new URL(request.url)
  const queryStringParameters: Record<string, string> = {}
  const multiValueQueryStringParameters: Record<string, string[]> = {}

  url.searchParams.forEach((value, key) => {
    queryStringParameters[key] = queryStringParameters[key] ? `${queryStringParameters[key]},${value}` : value
    multiValueQueryStringParameters[key] = [...multiValueQueryStringParameters[key], value]
  })

  const { headers, multiValueHeaders } = headersObjectFromWebHeaders(request.headers)
  const body = (await request.text()) || null

  return {
    blobs: '',
    rawUrl: url.toString(),
    rawQuery: url.search,
    path: url.pathname,
    httpMethod: request.method,
    headers,
    multiValueHeaders,
    queryStringParameters,
    multiValueQueryStringParameters,
    body,
    isBase64Encoded: shouldBase64Encode(request.headers.get('content-type') ?? ''),
  }
}

export const webResponseFromLambdaResponse = async (lambdaResponse: HandlerResponse): Promise<Response> => {
  return new Response(lambdaResponse.body, {
    headers: webHeadersFromHeadersObject(lambdaResponse.headers),
    status: lambdaResponse.statusCode,
  })
}
