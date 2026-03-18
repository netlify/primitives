export interface User {
  id: string
  email?: string
  confirmedAt?: string
  createdAt?: string
  updatedAt?: string
  role?: string
  provider?: string
  name?: string
  pictureUrl?: string
  roles?: string[]
  invitedAt?: string
  confirmationSentAt?: string
  recoverySentAt?: string
  pendingEmail?: string
  emailChangeSentAt?: string
  lastSignInAt?: string
  userMetadata?: Record<string, unknown>
  appMetadata?: Record<string, unknown>
}

export interface IdentityEvent {
  user: User
}
