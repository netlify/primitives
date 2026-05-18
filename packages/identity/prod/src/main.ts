export type { User } from './user.js'
export { getUser, isAuthenticated } from './user.js'
export { getIdentityConfig, getSettings } from './config.js'
export type { AuthCallback, AuthEvent } from './events.js'
export { AUTH_EVENTS, onAuthChange } from './events.js'
export type { CallbackResult } from './auth.js'
export { login, signup, logout, oauthLogin, handleAuthCallback, hydrateSession } from './auth.js'
export { refreshSession } from './refresh.js'
export { AuthError, MissingIdentityError } from './errors.js'
export { verifyRequestOrigin } from './csrf.js'
export type { VerifyRequestOriginOptions } from './csrf.js'
export type {
  AdminUserUpdates,
  AppMetadata,
  AuthProvider,
  CreateUserParams,
  IdentityConfig,
  ListUsersOptions,
  Settings,
  UserUpdates,
  SignupData,
} from './types.js'
export type { Admin } from './admin.js'
export {
  requestPasswordRecovery,
  recoverPassword,
  confirmEmail,
  acceptInvite,
  verifyEmailChange,
  updateUser,
} from './account.js'
export { admin } from './admin.js'
