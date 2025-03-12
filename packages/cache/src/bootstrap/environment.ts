export type Base64Encoder = (input: string) => string

export interface EnvironmentOptions {
  base64Encode: Base64Encoder
  getContext: RequestContextFactory
  userAgent?: string
}

export type RequestContextFactory = () => RequestContext

export interface RequestContext {
  host: string
  token: string
  url: string
}
