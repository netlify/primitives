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

interface BaseIdentityEvent {
  user: User
}

interface DeniableIdentityEvent extends BaseIdentityEvent {
  /**
   * Denies the action that triggered this event. The end user's request is
   * rejected with a 401.
   *
   * ```ts
   * if (!isAllowedEmail(event.user.email)) {
   *   return event.deny()
   * }
   * ```
   */
  deny(): undefined
}

interface IdentityHandlerResult {
  user: User
}

export type UserLoginEvent = DeniableIdentityEvent
export type UserSignupEvent = DeniableIdentityEvent
export type UserValidateEvent = DeniableIdentityEvent
export type UserModifiedEvent = DeniableIdentityEvent
export type UserDeletedEvent = BaseIdentityEvent

type MaybePromise<T> = T | Promise<T>

export type UserLoginHandler = (event: UserLoginEvent) => MaybePromise<IdentityHandlerResult | undefined>
export type UserSignupHandler = (event: UserSignupEvent) => MaybePromise<IdentityHandlerResult | undefined>
export type UserValidateHandler = (event: UserValidateEvent) => MaybePromise<IdentityHandlerResult | undefined>
export type UserModifiedHandler = (event: UserModifiedEvent) => MaybePromise<IdentityHandlerResult | undefined>
export type UserDeletedHandler = (event: UserDeletedEvent) => MaybePromise<undefined>
