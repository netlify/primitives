export interface Cookie {
  /** Name of the cookie. */
  name: string
  /** Value of the cookie. */
  value: string
  expires?: Date | number
  /** The cookie's `Max-Age` attribute, in seconds. Must be a non-negative integer. A cookie with a `maxAge` of `0` expires immediately. */
  maxAge?: number
  /** The cookie's `Domain` attribute. Specifies those hosts to which the cookie will be sent. */
  domain?: string
  /** The cookie's `Path` attribute. A cookie with a path will only be included in the `Cookie` request header if the requested URL matches that path. */
  path?: string
  /** The cookie's `Secure` attribute. If `true`, the cookie will only be included in the `Cookie` request header if the connection uses SSL and HTTPS. */
  secure?: boolean
  /** The cookie's `HTTPOnly` attribute. If `true`, the cookie cannot be accessed via JavaScript. */
  httpOnly?: boolean
  /**
   * Allows servers to assert that a cookie ought not to
   * be sent along with cross-site requests.
   */
  sameSite?: 'Strict' | 'Lax' | 'None'
  /** Additional key value pairs with the form "key=value" */
  unparsed?: string[]
}

interface DeleteCookieOptions {
  domain?: string
  name: string
  path?: string
}

export interface Cookies {
  delete: (input: string | DeleteCookieOptions) => void
  get: (key: string) => string
  set: {
    (cookie: Cookie): void
    (name: string, value: string): void
  }
}
