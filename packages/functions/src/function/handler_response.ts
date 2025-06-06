import type { PipelineSource } from 'node:stream'

export interface HandlerResponse {
  statusCode: number
  headers?: Record<string, boolean | number | string>
  multiValueHeaders?: Record<string, readonly (boolean | number | string)[]>
  body?: string
  isBase64Encoded?: boolean
}
export interface BuilderResponse extends HandlerResponse {
  ttl?: number
}

export interface StreamingResponse extends Omit<HandlerResponse, 'body'> {
  body?: string | PipelineSource<any>
}
