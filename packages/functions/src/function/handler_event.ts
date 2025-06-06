type EventHeaders = Record<string, string | undefined>

type EventMultiValueHeaders = Record<string, string[] | undefined>

type EventQueryStringParameters = Record<string, string | undefined>

type EventMultiValueQueryStringParameters = Record<string, string[] | undefined>

export interface HandlerEvent {
  rawUrl: string
  rawQuery: string
  path: string
  httpMethod: string
  headers: EventHeaders
  multiValueHeaders: EventMultiValueHeaders
  queryStringParameters: EventQueryStringParameters | null
  multiValueQueryStringParameters: EventMultiValueQueryStringParameters | null
  body: string | null
  isBase64Encoded: boolean
  route?: string
}
