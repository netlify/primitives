export type Base64Encoder = (input: string) => string

export type Logger = (...args: any[]) => void

export interface EnvironmentOptions {
  base64Encode: Base64Encoder
  getContext: RequestContextFactory
  userAgent?: string
}

export enum Operation {
  Delete = 'delete',
  Read = 'read',
  Write = 'write',
}

export type RequestContextFactory = (options: { operation: Operation }) => RequestContext | null

export interface RequestContext {
  host: string
  logger?: Logger
  token: string
  url: string
}
