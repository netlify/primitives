export type Base64Encoder = (input: string) => string
export type Factory<T> = () => T

export interface EnvironmentOptions {
  base64Encode: Base64Encoder
  getHost: Factory<string>
  getToken: Factory<string>
  getURL: Factory<string>
  userAgent?: string
}
