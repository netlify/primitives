export type Base64Encoder = (input: string) => string

export interface EnvironmentOptions {
  base64Encode: Base64Encoder
  getContext: RequestContextFactory
  userAgent?: string
}

type Method = 'delete' | 'get' | 'post'

export type RequestContextFactory = (opts: { method: Method }) => RequestContext | null

export interface RequestContext {
  host: string
  token: string
  url: string
}
