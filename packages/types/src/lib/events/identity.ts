export interface IdentityEvent {
  id: string
  aud: string
  role: string
  email: string
  confirmedAt: string | null
  invitedAt: string | null
  confirmationSentAt: string | null
  recoverySentAt: string | null
  newEmail: string | null
  emailChangeSentAt: string | null
  lastSignInAt: string | null
  appMetadata: Record<string, unknown>
  userMetadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
