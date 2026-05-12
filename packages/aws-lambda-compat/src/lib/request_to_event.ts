import type { HandlerContext } from './handler_context.js'
import type { HandlerEvent } from './handler_event.js'

const textContentTypes = new Set([
  'application/csp-report',
  'application/graphql',
  'application/json',
  'application/javascript',
  'application/x-www-form-urlencoded',
  'application/x-ndjson',
  'application/xml',
])

function shouldBase64Encode(contentType: string): boolean {
  if (!contentType) {
    return true
  }

  const [contentTypeSegment] = contentType.split(';')
  const normalized = contentTypeSegment.toLowerCase()

  if (normalized.startsWith('text/')) {
    return false
  }

  if (normalized.endsWith('+json') || normalized.endsWith('+xml')) {
    return false
  }

  if (textContentTypes.has(normalized)) {
    return false
  }

  return true
}

export async function buildEventFromRequest(request: Request): Promise<HandlerEvent> {
  const url = new URL(request.url)
  const queryStringParameters: Record<string, string> = {}
  const multiValueQueryStringParameters: Record<string, string[]> = {}

  url.searchParams.forEach((value, key) => {
    queryStringParameters[key] = value
    multiValueQueryStringParameters[key] = [...(multiValueQueryStringParameters[key] ?? []), value]
  })

  const headers: Record<string, string> = {}
  const multiValueHeaders: Record<string, string[]> = {}

  request.headers.forEach((value, key) => {
    headers[key] = value
    multiValueHeaders[key] = value.split(',').map((v) => v.trim())
  })

  const contentType = request.headers.get('content-type') ?? ''
  const isBinary = shouldBase64Encode(contentType)

  let body: string | null = null
  let isBase64Encoded = false

  if (request.body) {
    if (isBinary) {
      const buffer = await request.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binaryString = ''

      for (const byte of bytes) {
        binaryString += String.fromCharCode(byte)
      }

      body = btoa(binaryString)
      isBase64Encoded = true
    } else {
      body = await request.text()
      isBase64Encoded = false
    }
  }

  return {
    rawUrl: url.toString(),
    rawQuery: url.search.replace(/^\?/, ''),
    path: url.pathname,
    httpMethod: request.method,
    headers,
    multiValueHeaders,
    queryStringParameters: Object.keys(queryStringParameters).length > 0 ? queryStringParameters : null,
    multiValueQueryStringParameters:
      Object.keys(multiValueQueryStringParameters).length > 0 ? multiValueQueryStringParameters : null,
    body,
    isBase64Encoded,
  }
}

export function buildLambdaContext(context: { requestId: string }): HandlerContext {
  return {
    awsRequestId: context.requestId,
    callbackWaitsForEmptyEventLoop: true,
    functionName: '',
    functionVersion: '',
    invokedFunctionArn: '',
    memoryLimitInMB: '',
    logGroupName: '',
    logStreamName: '',
    getRemainingTimeInMillis: () => 0,
    done: () => {
      throw new Error('context.done() is not supported in Netlify Functions')
    },
    fail: () => {
      throw new Error('context.fail() is not supported in Netlify Functions')
    },
    succeed: () => {
      throw new Error('context.succeed() is not supported in Netlify Functions')
    },
  }
}
