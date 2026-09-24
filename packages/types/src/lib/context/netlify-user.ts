export interface NetlifyUser {
  /** Netlify user ID of the signed-in visitor. */
  id: string
  /** Email address on the visitor's Netlify account. */
  email?: string
  /** When the visitor's access to this site expires. */
  expiresAt: Date
}
