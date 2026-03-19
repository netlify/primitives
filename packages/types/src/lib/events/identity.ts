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

interface IdentityEvent {
  user: User
}

interface IdentityHandlerResult {
  user: User
}

export type UserLoginEvent = IdentityEvent
export type UserSignupEvent = IdentityEvent
export type UserValidateEvent = IdentityEvent
export type UserModifiedEvent = IdentityEvent
export type UserDeletedEvent = IdentityEvent

type MaybePromise<T> = T | Promise<T>

export type UserLoginHandler = (event: UserLoginEvent) => MaybePromise<IdentityHandlerResult | undefined>
export type UserSignupHandler = (event: UserSignupEvent) => MaybePromise<IdentityHandlerResult | undefined>
export type UserValidateHandler = (event: UserValidateEvent) => MaybePromise<IdentityHandlerResult | undefined>
export type UserModifiedHandler = (event: UserModifiedEvent) => MaybePromise<IdentityHandlerResult | undefined>
export type UserDeletedHandler = (event: UserDeletedEvent) => MaybePromise<undefined>
