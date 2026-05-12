export interface HandlerResponse {
  statusCode: number
  headers?: Record<string, boolean | number | string>
  multiValueHeaders?: Record<string, readonly (boolean | number | string)[]>
  body?: string
  isBase64Encoded?: boolean
}
