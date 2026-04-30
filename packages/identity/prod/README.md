# @netlify/identity

A lightweight, no-config headless authentication library for projects using Netlify Identity. Works in both browser and
server contexts. This is NOT the Netlify Identity Widget. This library exports standalone async functions (e.g., import
{ login, getUser } from '@netlify/identity'). There is no class to instantiate and no .init() call. Just import the
functions you need and call them.

**Prerequisites:**

- [Netlify Identity](https://docs.netlify.com/security/secure-access-to-sites/identity/) must be enabled on your Netlify
  project. This happens automatically when running within a
  [Netlify Agent Runner](https://docs.netlify.com/agent-runner/overview/)
- **Server-side** functions (`getUser`, `login`, `admin.*`, etc.) require
  [Netlify Functions](https://docs.netlify.com/build/functions/get-started/) (modern/v2, with `export default`) or
  [Edge Functions](https://docs.netlify.com/edge-functions/overview/).
  [Lambda-compatible functions](https://docs.netlify.com/build/functions/lambda-compatibility/) (v1, with
  `export { handler }`) are **not supported**
- For local development, use [`netlify dev`](https://docs.netlify.com/cli/local-development/) so the Identity endpoint
  is available

## How this library relates to other Netlify auth packages

`@netlify/identity` is the recommended library for all new projects. It works in both browser and server contexts,
handles cookie management, and normalizes the user object.

You may encounter two older packages in existing code or documentation:

| Package                                                                         | Status                           | What it was                                   |
| ------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------------- |
| [`netlify-identity-widget`](https://github.com/netlify/netlify-identity-widget) | Not recommended for new projects | Pre-built login/signup modal with built-in UI |
| [`gotrue-js`](https://github.com/netlify/gotrue-js)                             | Not recommended for new projects | Low-level GoTrue HTTP client (browser only)   |

If you need a pre-built login UI, the widget still works. For everything else (custom UI, server-side auth, admin
operations, framework integration), use `@netlify/identity`.

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [API](#api)
  - [Functions](#functions) -- `getUser`, `login`, `signup`, `logout`, `oauthLogin`, `handleAuthCallback`,
    `onAuthChange`, `hydrateSession`, `refreshSession`, `verifyRequestOrigin`, and more
  - [Admin Operations](#admin-operations) -- `admin.listUsers`, `admin.getUser`, `admin.createUser`, `admin.updateUser`,
    `admin.deleteUser`
  - [Types](#types) -- `User`, `AuthEvent`, `CallbackResult`, `Settings`, `Admin`, `ListUsersOptions`,
    `CreateUserParams`, `VerifyRequestOriginOptions`, etc.
  - [Errors](#errors) -- `AuthError`, `MissingIdentityError`
- [Security: CSRF protection](#security-csrf-protection)
- [Framework integration](#framework-integration) -- Next.js, Remix, TanStack Start, Astro, SvelteKit
- [Guides](#guides)
  - [React `useAuth` hook](#react-useauth-hook)
  - [Listening for auth changes](#listening-for-auth-changes)
  - [OAuth login](#oauth-login)
  - [Password recovery](#password-recovery)
  - [Invite acceptance](#invite-acceptance)
  - [Session lifetime](#session-lifetime)
  - [Caching and authenticated content](#caching-and-authenticated-content)

## Installation

```bash
npm install @netlify/identity
```

## Quick start

### Log in (browser)

```ts
import { login, getUser } from '@netlify/identity'

// Log in
const user = await login('jane@example.com', 'password123')
console.log(`Hello, ${user.name}`)

// Later, check auth state
const currentUser = await getUser()
```

### Protect a Netlify Function

```ts
import { getUser } from '@netlify/identity'
import type { Context } from '@netlify/functions'

export default async (req: Request, context: Context) => {
  const user = await getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  return Response.json({ id: user.id, email: user.email })
}
```

### Protect an Edge Function

```ts
import { getUser } from '@netlify/identity'
import type { Context } from '@netlify/edge-functions'

export default async (req: Request, context: Context) => {
  const user = await getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  return Response.json({ id: user.id, email: user.email })
}
```

## API

### Functions

#### `getUser`

```ts
getUser(): Promise<User | null>
```

Returns the current authenticated user, or `null` if not logged in. Returns the best available normalized `User` from
the current context. When the Identity API is reachable, most persisted and profile fields are populated, but
state-dependent fields (invite, recovery, email-change) may still be `undefined` if the user is not in that state. When
falling back to JWT claims (e.g., Identity API unreachable), only `id`, `email`, `provider`, `name`, `pictureUrl`,
`roles`, `userMetadata`, and `appMetadata` are available. Never throws.

> **Next.js note:** Calling `getUser()` in a Server Component opts the page into
> [dynamic rendering](https://nextjs.org/docs/app/building-your-application/rendering/server-components#dynamic-rendering)
> because it reads cookies. This is expected and correct for authenticated pages. Next.js handles the internal dynamic
> rendering signal automatically.

#### `isAuthenticated`

```ts
isAuthenticated(): Promise<boolean>
```

Returns `true` if a user is currently authenticated. Equivalent to `(await getUser()) !== null`. Never throws.

#### `getIdentityConfig`

```ts
getIdentityConfig(): IdentityConfig | null
```

Returns the Identity endpoint URL (and operator token on the server), or `null` if Identity is not available. Never
throws.

#### `getSettings`

```ts
getSettings(): Promise<Settings>
```

Fetches your project's Identity settings (enabled providers, autoconfirm, signup disabled).

**Throws:** `MissingIdentityError` if Identity is not configured. `AuthError` if the endpoint is unreachable.

#### `login`

```ts
login(email: string, password: string): Promise<User>
```

Logs in with email and password. Works in both browser and server contexts.

In the browser, emits a `'login'` event. On the server (Netlify Functions, Edge Functions), calls the Identity API
directly and sets the `nf_jwt` cookie via the Netlify runtime.

**Throws:** `AuthError` on invalid credentials or network failure. In the browser, `MissingIdentityError` if Identity is
not configured. On the server, `AuthError` if the Netlify Functions runtime is not available.

#### `signup`

```ts
signup(email: string, password: string, data?: SignupData): Promise<User>
```

Creates a new account. Works in both browser and server contexts.

If autoconfirm is enabled in your Identity settings, the user is logged in immediately: cookies are set and a `'login'`
event is emitted. If autoconfirm is **disabled** (the default), the user receives a confirmation email and must click
the link before they can log in. In that case, no cookies are set and no auth event is emitted.

The optional `data` parameter sets user metadata (e.g., `{ full_name: 'Jane Doe' }`), stored in the user's
`user_metadata` field.

**Throws:** `AuthError` on failure (e.g., email already registered, signup disabled). In the browser,
`MissingIdentityError` if Identity is not configured. On the server, `AuthError` if the Netlify Functions runtime is not
available.

#### `logout`

```ts
logout(): Promise<void>
```

Logs out the current user and clears the session. Works in both browser and server contexts.

In the browser, emits a `'logout'` event. On the server, calls the Identity `/logout` endpoint with the JWT from the
`nf_jwt` cookie, then deletes the cookie. Auth cookies are always cleared, even if the server call fails.

**Throws:** In the browser, `MissingIdentityError` if Identity is not configured. On the server, `AuthError` if the
Netlify Functions runtime is not available.

#### `oauthLogin`

```ts
oauthLogin(provider: string): never
```

Redirects to an OAuth provider. The page navigates away, so this function never returns normally. Browser only.

The `provider` argument should be one of the `AuthProvider` values: `'google'`, `'github'`, `'gitlab'`, `'bitbucket'`,
or `'facebook'`.

**Throws:** `MissingIdentityError` if Identity is not configured. `AuthError` if called on the server.

#### `handleAuthCallback`

```ts
handleAuthCallback(): Promise<CallbackResult | null>
```

Processes the URL hash after an OAuth redirect, email confirmation, password recovery, invite acceptance, or email
change. Call on page load. Returns `null` if the hash contains no auth parameters. Browser only.

**Throws:** `MissingIdentityError` if Identity is not configured. `AuthError` if token exchange fails.

#### `onAuthChange`

```ts
onAuthChange(callback: AuthCallback): () => void
```

Subscribes to auth state changes (login, logout, token refresh, user updates, and recovery). Returns an unsubscribe
function. Also fires on cross-tab session changes. No-op on the server. The `'recovery'` event fires when
`handleAuthCallback()` processes a password recovery token; listen for it to redirect users to a password reset form.

#### `hydrateSession`

```ts
hydrateSession(): Promise<User | null>
```

Bootstraps the browser-side session from server-set auth cookies (`nf_jwt`, `nf_refresh`). Returns the hydrated `User`,
or `null` if no auth cookies are present. No-op on the server.

**When to use:** After a server-side login (e.g., via a Netlify Function or Server Action), the `nf_jwt` cookie is set
but no browser session exists yet. `getUser()` calls `hydrateSession()` automatically, but account operations like
`updateUser()` or `verifyEmailChange()` require a live browser session. Call `hydrateSession()` explicitly if you need
the session ready before calling those operations.

If a browser session already exists (e.g., from a browser-side login), this is a no-op and returns the existing user.

```ts
import { hydrateSession, updateUser } from '@netlify/identity'

// On page load, hydrate the session from server-set cookies
await hydrateSession()

// Now browser account operations work
await updateUser({ data: { full_name: 'Jane Doe' } })
```

#### `refreshSession`

```ts
refreshSession(): Promise<string | null>
```

Refreshes an expired or near-expired session. Returns the new access token on success, or `null` if no refresh is needed
or the refresh token is invalid/missing.

**Browser:** Checks if the current access token is near expiry and refreshes it if needed, syncing the new token to the
`nf_jwt` cookie. Note: the library automatically refreshes tokens in the background after any browser flow that
establishes a session (`login()`, `signup()`, `hydrateSession()`, `handleAuthCallback()`, `confirmEmail()`,
`recoverPassword()`, `acceptInvite()`), so you typically don't need to call this manually. `getUser()` also restarts the
refresh timer when it finds an existing session. Browser-side errors return `null`, not an `AuthError`.

**Server:** Reads the `nf_jwt` and `nf_refresh` cookies. If the access token is expired or within 60 seconds of expiry,
exchanges the refresh token for a new access token via the Identity `/token` endpoint and updates both cookies on the
response. Call this in framework middleware or at the start of server-side request handlers to ensure the JWT is valid
for downstream processing.

**Throws:** `AuthError` on network failure or if the Identity endpoint URL cannot be determined. Does **not** throw for
invalid/expired refresh tokens (returns `null` instead).

```ts
// Example: Astro middleware
import { refreshSession } from '@netlify/identity'

export async function onRequest(context, next) {
  await refreshSession()
  return next()
}
```

#### `verifyRequestOrigin`

```ts
verifyRequestOrigin(request: Request, options?: VerifyRequestOriginOptions): void
```

CSRF protection helper for server-side endpoints that call `login()`, `signup()`, or `logout()`. Compares the request's
`Origin` header against the request's own origin (or an explicit allowlist via `options.allowedOrigins`) and throws if
they don't match. Server-only.

The check runs unconditionally on every call: any HTTP method, with or without an `Origin` header. If you don't want the
check on a particular route, don't call the helper there.

**Throws:** `AuthError` with status `403` when the request has no `Origin` header. `AuthError` with status `403` when
the request's `Origin` is not in the allowed origins.

See [Security: CSRF protection](#security-csrf-protection) for the full threat model and per-framework guidance.

#### `requestPasswordRecovery`

```ts
requestPasswordRecovery(email: string): Promise<void>
```

Sends a password recovery email to the given address.

**Throws:** `MissingIdentityError` if Identity is not configured. `AuthError` on network failure.

#### `confirmEmail`

```ts
confirmEmail(token: string): Promise<User>
```

Confirms an email address using the token from a confirmation email. Logs the user in on success.

**Throws:** `MissingIdentityError` if Identity is not configured. `AuthError` if the token is invalid or expired.

#### `acceptInvite`

```ts
acceptInvite(token: string, password: string): Promise<User>
```

Accepts an invite token and sets a password for the new account. Logs the user in on success.

**Throws:** `MissingIdentityError` if Identity is not configured. `AuthError` if the token is invalid or expired.

#### `verifyEmailChange`

```ts
verifyEmailChange(token: string): Promise<User>
```

Verifies an email change using the token from a verification email.

**Throws:** `MissingIdentityError` if Identity is not configured. `AuthError` if the token is invalid.

#### `recoverPassword`

```ts
recoverPassword(token: string, newPassword: string): Promise<User>
```

Redeems a recovery token and sets a new password. Logs the user in on success.

**Throws:** `MissingIdentityError` if Identity is not configured. `AuthError` if the token is invalid or expired.

#### `updateUser`

```ts
updateUser(updates: UserUpdates): Promise<User>
```

Updates the current user's metadata or credentials. Requires an active session. Pass `email` or `password` to change
credentials, or `data` to update user metadata (e.g., `{ data: { full_name: 'New Name' } }`).

**Throws:** `MissingIdentityError` if Identity is not configured. `AuthError` if no user is logged in, or the update
fails.

### Admin Operations

The `admin` namespace provides server-only user management functions. Admin methods use the operator token from the
Netlify runtime, which is automatically available in Netlify Functions and Edge Functions.

Calling any admin method from a browser environment throws an `AuthError`.

```ts
import { admin } from '@netlify/identity'
```

**Example: managing users in a Netlify Function**

```ts
import { admin } from '@netlify/identity'
import type { Context } from '@netlify/functions'

export default async (req: Request, context: Context) => {
  // List all users
  const users = await admin.listUsers()

  // Create a new user (auto-confirmed, no email sent)
  const newUser = await admin.createUser({
    email: 'jane@example.com',
    password: 'securepassword',
    data: { user_metadata: { full_name: 'Jane Doe' } },
  })

  // Update a user's role
  await admin.updateUser(newUser.id, { role: 'editor' })

  return Response.json({ created: newUser.id, total: users.length })
}
```

#### `admin.listUsers`

```ts
admin.listUsers(options?: ListUsersOptions): Promise<User[]>
```

Lists all users. Pagination options (`page`, `perPage`) are forwarded as query parameters.

**Throws:** `AuthError` if called from a browser, or if the operator token is missing.

#### `admin.getUser`

```ts
admin.getUser(userId: string): Promise<User>
```

Gets a single user by ID.

**Throws:** `AuthError` if called from a browser, the user is not found, or the operator token is missing.

#### `admin.createUser`

```ts
admin.createUser(params: CreateUserParams): Promise<User>
```

Creates a new user. The user is auto-confirmed. Optional `data` forwards allowed fields (`role`, `app_metadata`,
`user_metadata`) to the request body. Other keys are silently ignored. `data` cannot override `email`, `password`, or
`confirm`.

**Throws:** `AuthError` if called from a browser, the email already exists, or the operator token is missing.

#### `admin.updateUser`

```ts
admin.updateUser(userId: string, attributes: AdminUserUpdates): Promise<User>
```

Updates an existing user by ID. Only typed `AdminUserUpdates` fields are forwarded (e.g.,
`{ email: 'new@example.com' }`, `{ role: 'editor' }`).

**Throws:** `AuthError` if called from a browser, the user is not found, or the update fails.

#### `admin.deleteUser`

```ts
admin.deleteUser(userId: string): Promise<void>
```

Deletes a user by ID.

**Throws:** `AuthError` if called from a browser, the user is not found, or the deletion fails.

### Types

#### `User`

```ts
interface User {
  id: string
  email?: string
  confirmedAt?: string
  createdAt?: string
  updatedAt?: string
  role?: string
  provider?: AuthProvider
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
```

#### `Settings`

```ts
interface Settings {
  autoconfirm: boolean
  disableSignup: boolean
  providers: Record<AuthProvider, boolean>
}
```

#### `IdentityConfig`

```ts
interface IdentityConfig {
  url: string
  token?: string
}
```

#### `AuthProvider`

```ts
type AuthProvider = 'google' | 'github' | 'gitlab' | 'bitbucket' | 'facebook' | 'email'
```

#### `UserUpdates`

```ts
interface UserUpdates {
  email?: string
  password?: string
  data?: Record<string, unknown>
  [key: string]: unknown
}
```

Fields accepted by `updateUser()`. All fields are optional.

#### `AdminUserUpdates`

```ts
interface AdminUserUpdates {
  email?: string
  password?: string
  role?: string
  confirm?: boolean
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
}
```

Fields accepted by `admin.updateUser()`. Unlike `UserUpdates`, admin updates can set `role`, force-confirm a user, and
write to `app_metadata`. Only these typed fields are forwarded.

#### `SignupData`

```ts
type SignupData = Record<string, unknown>
```

User metadata passed as the third argument to `signup()`. Stored in the user's `user_metadata` field.

#### `AppMetadata`

```ts
interface AppMetadata {
  provider: AuthProvider
  roles?: string[]
  [key: string]: unknown
}
```

#### `ListUsersOptions`

```ts
interface ListUsersOptions {
  page?: number
  perPage?: number
}
```

Pagination options for `admin.listUsers()`.

#### `CreateUserParams`

```ts
interface CreateUserParams {
  email: string
  password: string
  data?: Record<string, unknown>
}
```

Parameters for `admin.createUser()`. Optional `data` forwards allowed fields (`role`, `app_metadata`, `user_metadata`)
to the request body. Other keys are silently ignored.

#### `Admin`

```ts
interface Admin {
  listUsers: (options?: ListUsersOptions) => Promise<User[]>
  getUser: (userId: string) => Promise<User>
  createUser: (params: CreateUserParams) => Promise<User>
  updateUser: (userId: string, attributes: AdminUserUpdates) => Promise<User>
  deleteUser: (userId: string) => Promise<void>
}
```

The type of the `admin` export. Useful for passing the admin namespace as a dependency.

#### `AUTH_EVENTS`

```ts
const AUTH_EVENTS: {
  LOGIN: 'login'
  LOGOUT: 'logout'
  TOKEN_REFRESH: 'token_refresh'
  USER_UPDATED: 'user_updated'
  RECOVERY: 'recovery'
}
```

Constants for auth event names. Use these instead of string literals for type safety and autocomplete.

| Event           | When it fires                                                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LOGIN`         | `login()`, `signup()` (with autoconfirm), `recoverPassword()`, `confirmEmail()`, `acceptInvite()`, `handleAuthCallback()` (OAuth/confirmation), `hydrateSession()`                                                                                                                                                                                                              |
| `LOGOUT`        | `logout()`                                                                                                                                                                                                                                                                                                                                                                      |
| `TOKEN_REFRESH` | The library's auto-refresh timer refreshes an expiring access token and syncs the new token to the `nf_jwt` cookie. Fires automatically after any session-establishing flow: `login()`, `signup()`, `hydrateSession()`, `handleAuthCallback()`, `confirmEmail()`, `recoverPassword()`, `acceptInvite()`. `getUser()` also restarts the timer when it finds an existing session. |
| `USER_UPDATED`  | `updateUser()`, `verifyEmailChange()`, `handleAuthCallback()` (email change)                                                                                                                                                                                                                                                                                                    |
| `RECOVERY`      | `handleAuthCallback()` (recovery token only). The user is authenticated but has **not** set a new password yet. Listen for this to redirect to a password reset form. `recoverPassword()` emits `LOGIN` instead because it completes both steps (token redemption + password change).                                                                                           |

#### `AuthEvent`

```ts
type AuthEvent = 'login' | 'logout' | 'token_refresh' | 'user_updated' | 'recovery'
```

#### `AuthCallback`

```ts
type AuthCallback = (event: AuthEvent, user: User | null) => void
```

#### `CallbackResult`

```ts
interface CallbackResult {
  type: 'oauth' | 'confirmation' | 'recovery' | 'invite' | 'email_change'
  user: User | null
  token?: string
}
```

The `token` field is only present for `invite` callbacks, where the user hasn't set a password yet. Pass `token` to
`acceptInvite(token, password)` to finish.

For all other types (`oauth`, `confirmation`, `recovery`, `email_change`), the user is logged in directly and `token` is
not set.

#### `VerifyRequestOriginOptions`

```ts
interface VerifyRequestOriginOptions {
  allowedOrigins?: string[]
}
```

Options for [`verifyRequestOrigin`](#verifyrequestorigin). When `allowedOrigins` is set, the list replaces the default
same-origin check, so include the request's own origin if you still want it allowed. Each value is a full origin string
with scheme and host (`'https://example.com'`).

### Errors

#### `AuthError`

```ts
class AuthError extends Error {
  status?: number
  cause?: unknown
}
```

#### `MissingIdentityError`

```ts
class MissingIdentityError extends Error {}
```

Thrown when Identity is not configured in the current environment.

## Security: CSRF protection

If you expose server-side `login()`, `signup()`, or `logout()` through an HTTP endpoint, that endpoint needs Cross-Site
Request Forgery (CSRF) protection. The library cannot enforce this itself because it only sees the email and password
arguments handed to it, not the incoming request.

**Why it matters.** A specific flavor called _login CSRF_ lets an attacker trick a victim's browser into logging into
the attacker's account. The victim then performs actions inside that session (saving payment info, linking third-party
services, uploading content), and the attacker harvests the result later by signing in with the credentials they always
controlled. `SameSite=Lax` cookies do not catch this attack because the session is being created on the victim's
browser, not ridden from an existing one.

### `verifyRequestOrigin`

`verifyRequestOrigin(request, options?)` compares the request's `Origin` header against the request's own origin (or an
explicit allowlist) and throws `AuthError` with status 403 on mismatch. Call it at the start of any handler that
performs an auth mutation.

```ts
// netlify/functions/login.ts
import { login, verifyRequestOrigin } from '@netlify/identity'
import type { Context } from '@netlify/functions'

export default async (req: Request, context: Context) => {
  verifyRequestOrigin(req)
  const { email, password } = await req.json()
  await login(email, password)
  return new Response(null, { status: 302, headers: { Location: '/dashboard' } })
}
```

The helper runs unconditionally on every call. It checks any HTTP method, with or without an `Origin` header. If you
don't want the check on a particular route, don't call the helper there.

### Custom allowed origins

By default, the helper accepts only the request's own origin. Pass `allowedOrigins` to allow additional trusted origins
(for example, a separate frontend domain that POSTs to an API on another domain). The list replaces the default, so
include the request's own origin if you still want it allowed:

```ts
verifyRequestOrigin(req, {
  allowedOrigins: ['https://app.example.com', 'https://www.example.com'],
})
```

### When to call the helper

Some frameworks check the request's `Origin` on state-changing requests by default; others don't. Check your framework's
documentation. If same-origin enforcement is already on by default for the endpoint where you invoke `login()` /
`signup()` / `logout()`, calling `verifyRequestOrigin` yourself is redundant. If it isn't, call
`verifyRequestOrigin(request)` at the start of the handler before invoking the auth function.

## Framework integration

### Recommended pattern for SSR frameworks

For SSR frameworks (Next.js, Remix, Astro, TanStack Start), the recommended pattern is:

- **Browser-side** for auth mutations: `login()`, `signup()`, `logout()`, `oauthLogin()`
- **Server-side** for reading auth state: `getUser()`, `getSettings()`, `getIdentityConfig()`

Browser-side auth mutations call the Identity API directly from the browser, set the `nf_jwt` cookie, and emit
`onAuthChange` events. This keeps the client UI in sync immediately. Server-side reads work because the cookie is sent
with every request.

The library also supports server-side mutations (`login()`, `signup()`, `logout()` inside Netlify Functions), but these
require the Netlify Functions runtime to set cookies. After a server-side mutation, you need a full page navigation so
the browser sends the new cookie.

### Next.js (App Router)

**Server Actions return results; the client handles navigation:**

```tsx
// app/actions.ts
'use server'
import { login, logout } from '@netlify/identity'

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  await login(email, password)
  return { success: true }
}

export async function logoutAction() {
  await logout()
  return { success: true }
}
```

```tsx
// app/login/page.tsx
'use client'
import { loginAction } from '../actions'

export default function LoginPage() {
  async function handleSubmit(formData: FormData) {
    const result = await loginAction(formData)
    if (result.success) {
      window.location.href = '/dashboard' // full page load
    }
  }

  return <form action={handleSubmit}>...</form>
}
```

```tsx
// app/dashboard/page.tsx
import { getUser } from '@netlify/identity'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const user = await getUser()
  if (!user) redirect('/login')

  return <h1>Hello, {user.email}</h1>
}
```

Use `window.location.href` instead of Next.js `redirect()` after server-side auth mutations. Next.js `redirect()`
triggers a soft navigation via the Router, which may not include the newly-set auth cookie. A full page load ensures the
cookie is sent and the server sees the updated auth state. Reading auth state with `getUser()` in Server Components
works normally, and `redirect()` is fine for auth gates (where no cookie was just set).

### Remix

**Login with Action (server-side pattern):**

```tsx
// app/routes/login.tsx
import { login, verifyRequestOrigin } from '@netlify/identity'
import { redirect, json } from '@remix-run/node'
import type { ActionFunctionArgs } from '@remix-run/node'

export async function action({ request }: ActionFunctionArgs) {
  verifyRequestOrigin(request)
  const formData = await request.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    await login(email, password)
    return redirect('/dashboard')
  } catch (error) {
    return json({ error: (error as Error).message }, { status: 400 })
  }
}
```

```tsx
// app/routes/dashboard.tsx
import { getUser } from '@netlify/identity'
import { redirect } from '@remix-run/node'

export async function loader() {
  const user = await getUser()
  if (!user) return redirect('/login')
  return { user }
}
```

Remix `redirect()` works after server-side `login()` because Remix actions return real HTTP responses. The browser
receives a 302 with the `Set-Cookie` header already applied, so the next request includes the auth cookie. This is
different from Next.js, where `redirect()` in a Server Action triggers a client-side (soft) navigation that may not
include newly-set cookies.

> The example calls [`verifyRequestOrigin`](#verifyrequestorigin) at the top of the action. See
> [Security: CSRF protection](#security-csrf-protection) for when this is needed.

### TanStack Start

**Login from the browser (recommended):**

```tsx
// app/server/auth.ts - server functions for reads only
import { createServerFn } from '@tanstack/react-start'
import { getUser } from '@netlify/identity'

export const getServerUser = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getUser()
  return user ?? null
})
```

```tsx
// app/routes/login.tsx - browser-side auth for mutations
import { login, signup, onAuthChange } from '@netlify/identity'
import { getServerUser } from '~/server/auth'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    const user = await getServerUser()
    if (user) throw redirect({ to: '/dashboard' })
  },
  component: Login,
})

function Login() {
  const handleLogin = async (email: string, password: string) => {
    await login(email, password) // browser-side: sets cookie + localStorage
    window.location.href = '/dashboard'
  }
  // ...
}
```

```tsx
// app/routes/dashboard.tsx
import { logout } from '@netlify/identity'
import { getServerUser } from '~/server/auth'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const user = await getServerUser()
    if (!user) throw redirect({ to: '/login' })
  },
  loader: async () => {
    const user = await getServerUser()
    return { user: user! }
  },
  component: Dashboard,
})

function Dashboard() {
  const { user } = Route.useLoaderData()

  const handleLogout = async () => {
    await logout() // browser-side: clears cookie + localStorage
    window.location.href = '/'
  }
  // ...
}
```

Use `window.location.href` instead of TanStack Router's `navigate()` after auth changes. This ensures the browser sends
the updated cookie on the next request.

### Astro (SSR)

**Login via API endpoint (server-side pattern):**

```ts
// src/pages/api/login.ts
import type { APIRoute } from 'astro'
import { login } from '@netlify/identity'

export const POST: APIRoute = async ({ request }) => {
  const { email, password } = await request.json()

  try {
    await login(email, password)
    return new Response(null, {
      status: 302,
      headers: { Location: '/dashboard' },
    })
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 })
  }
}
```

```astro
---
// src/pages/dashboard.astro
import { getUser } from '@netlify/identity'

const user = await getUser()
if (!user) return Astro.redirect('/login')
---
<h1>Hello, {user.email}</h1>
```

### SvelteKit

**Login from the browser (recommended):**

```svelte
<!-- src/routes/login/+page.svelte -->
<script lang="ts">
  import { login } from '@netlify/identity'

  let email = ''
  let password = ''
  let error = ''

  async function handleLogin() {
    try {
      await login(email, password)
      window.location.href = '/dashboard'
    } catch (e) {
      error = (e as Error).message
    }
  }
</script>

<form on:submit|preventDefault={handleLogin}>
  <input bind:value={email} type="email" />
  <input bind:value={password} type="password" />
  <button type="submit">Log in</button>
  {#if error}<p>{error}</p>{/if}
</form>
```

```ts
// src/routes/dashboard/+page.server.ts
import { getUser } from '@netlify/identity'
import { redirect } from '@sveltejs/kit'

export async function load() {
  const user = await getUser()
  if (!user) redirect(302, '/login')
  return { user }
}
```

### Handling OAuth callbacks in SPAs

All SPA frameworks need a callback handler that runs on page load to process OAuth redirects, email confirmations, and
password recovery tokens. Use a **wrapper component** that blocks page content while processing tokens. This prevents a
flash of unauthenticated content that occurs when the page renders before the callback completes.

```tsx
// React component (works with Next.js, Remix, TanStack Start)
import { useEffect, useState } from 'react'
import { handleAuthCallback } from '@netlify/identity'

const AUTH_HASH_PATTERN = /^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/

export function CallbackHandler({ children }: { children: React.ReactNode }) {
  const [processing, setProcessing] = useState(
    () => typeof window !== 'undefined' && AUTH_HASH_PATTERN.test(window.location.hash),
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!window.location.hash || !AUTH_HASH_PATTERN.test(window.location.hash)) return

    handleAuthCallback()
      .then((result) => {
        if (!result) {
          setProcessing(false)
          return
        }
        if (result.type === 'invite') {
          window.location.href = `/accept-invite?token=${result.token}`
        } else if (result.type === 'recovery') {
          window.location.href = '/reset-password'
        } else {
          window.location.href = '/dashboard'
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Callback failed')
        setProcessing(false)
      })
  }, [])

  if (error) return <div>Auth error: {error}</div>
  if (processing) return <div>Confirming your account...</div>
  return <>{children}</>
}
```

Wrap your page content with this component in your **root layout** so it runs on every page:

```tsx
// Root layout
<CallbackHandler>
  <Outlet /> {/* or {children} in Next.js */}
</CallbackHandler>
```

If you only mount it on a `/callback` route, OAuth redirects and email confirmation links that land on other pages will
not be processed.

## Guides

### React `useAuth` hook

The library is framework-agnostic, but here's a simple React hook for keeping components in sync with auth state:

```tsx
import { useState, useEffect } from 'react'
import { getUser, onAuthChange } from '@netlify/identity'
import type { User } from '@netlify/identity'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    getUser().then(setUser)
    return onAuthChange((_event, user) => setUser(user))
  }, [])

  return user
}
```

```tsx
function NavBar() {
  const user = useAuth()
  return user ? <p>Hello, {user.name}</p> : <a href="/login">Log in</a>
}
```

### Listening for auth changes

Use `onAuthChange` to keep your UI in sync with auth state. It fires on login, logout, token refresh, user updates, and
recovery. It also detects session changes in other browser tabs (via `localStorage`).

```ts
import { onAuthChange, AUTH_EVENTS } from '@netlify/identity'

const unsubscribe = onAuthChange((event, user) => {
  switch (event) {
    case AUTH_EVENTS.LOGIN:
      console.log('Logged in:', user?.email)
      break
    case AUTH_EVENTS.LOGOUT:
      console.log('Logged out')
      break
    case AUTH_EVENTS.TOKEN_REFRESH:
      console.log('Token refreshed for:', user?.email)
      break
    case AUTH_EVENTS.USER_UPDATED:
      console.log('User updated:', user?.email)
      break
    case AUTH_EVENTS.RECOVERY:
      console.log('Recovery login:', user?.email)
      // Redirect to password reset form, then call updateUser({ password })
      break
  }
})

// Later, to stop listening:
unsubscribe()
```

On the server, `onAuthChange` is a no-op and the returned unsubscribe function does nothing.

### OAuth login

OAuth login is a two-step flow: redirect the user to the provider, then process the callback when they return.

**Step by step:**

```ts
import { oauthLogin, handleAuthCallback } from '@netlify/identity'

// 1. Kick off the OAuth flow (e.g., from a "Sign in with GitHub" button).
//    This navigates away from the page and does not return.
oauthLogin('github')
```

```ts
// 2. On page load, handle the redirect back from the provider.
const result = await handleAuthCallback()

if (result?.type === 'oauth') {
  console.log('Logged in via OAuth:', result.user?.email)
}
```

`handleAuthCallback()` exchanges the token in the URL hash, logs the user in, clears the hash, and emits an auth event
via `onAuthChange` (`'login'` for OAuth/confirmation, `'recovery'` for password recovery).

### Password recovery

Password recovery is a two-step flow. The library handles the token exchange automatically via `handleAuthCallback()`,
which logs the user in and returns `{type: 'recovery', user}`. A `'recovery'` event (not `'login'`) is emitted via
`onAuthChange`, so event-based listeners can also detect this flow. You then show a "set new password" form and call
`updateUser()` to save it.

**Step by step:**

```ts
import { requestPasswordRecovery, handleAuthCallback, updateUser } from '@netlify/identity'

// 1. Send recovery email (e.g., from a "forgot password" form)
await requestPasswordRecovery('jane@example.com')

// 2-3. On page load, handle the callback
const result = await handleAuthCallback()

if (result?.type === 'recovery') {
  // 4. User is now logged in. Show your "set new password" form.
  //    When they submit:
  const newPassword = document.getElementById('new-password').value
  await updateUser({ password: newPassword })
}
```

If you use the event-based pattern instead of checking `result.type`, listen for the `'recovery'` event:

```ts
import { onAuthChange, AUTH_EVENTS } from '@netlify/identity'

onAuthChange((event, user) => {
  if (event === AUTH_EVENTS.RECOVERY) {
    // Redirect to password reset form.
    // The user is authenticated, so call updateUser({ password }) to set the new password.
  }
})
```

### Invite acceptance

When an admin invites a user, they receive an email with an invite link. Clicking it redirects to your site with an
`invite_token` in the URL hash. Unlike other callback types, the user is not logged in automatically because they need
to set a password first.

**Step by step:**

```ts
import { handleAuthCallback, acceptInvite } from '@netlify/identity'

// 1. On page load, handle the callback.
const result = await handleAuthCallback()

if (result?.type === 'invite' && result.token) {
  // 2. The user is NOT logged in yet. Show a "set your password" form.
  //    When they submit:
  const password = document.getElementById('password').value
  const user = await acceptInvite(result.token, password)
  console.log('Account created:', user.email)
}
```

### Session lifetime

Sessions are managed by Netlify Identity on the server side. The library stores two cookies:

- **`nf_jwt`**: A short-lived JWT access token (default: 1 hour).
- **`nf_refresh`**: A long-lived refresh token used to obtain new access tokens without re-authenticating.

**Browser auto-refresh:** After any session-establishing flow (`login()`, `signup()`, `hydrateSession()`,
`handleAuthCallback()`, `confirmEmail()`, `recoverPassword()`, `acceptInvite()`), the library automatically schedules a
background refresh 60 seconds before the access token expires. `getUser()` also restarts the refresh timer when it finds
an existing session (e.g., after a page reload). When the refresh fires, it obtains a new access token, syncs it to the
`nf_jwt` cookie, and emits a `TOKEN_REFRESH` event. This keeps the cookie fresh as long as the user has the tab open. If
the refresh fails (e.g., the refresh token was revoked), the timer stops and the user will need to log in again.

**Server-side refresh:** On the server, the access token in the `nf_jwt` cookie is validated as-is. If it has expired
and no refresh happens, `getUser()` returns `null`. To handle this, call `refreshSession()` in your framework middleware
or request handler. This checks if the token is near expiry, exchanges the refresh token for a new one, and updates the
cookies on the response.

Session lifetime is configured in your Netlify Identity settings, not in this library.

### Caching and authenticated content

Pages that display user-specific data (names, emails, roles, account settings) should not be served from a shared cache.
If a cache stores an authenticated response and serves it to a different user, that user sees someone else's data. This
applies to any authentication system, not just Netlify Identity.

**Next.js App Router** has multiple caching layers that are active by default:

- **Static rendering:** Server Components are statically rendered at build time unless they call a
  [Dynamic API](https://nextjs.org/docs/app/guides/caching#dynamic-rendering) like `cookies()`. This library's
  `getUser()` already calls `headers()` internally to opt the route into dynamic rendering, but if you check auth state
  without calling `getUser()` (e.g., reading the `nf_jwt` cookie directly), the page may still be statically cached.
  Always use `getUser()` rather than reading cookies directly.
- **ISR (Incremental Static Regeneration):** Do not use ISR for pages that display user-specific content. ISR
  regenerates the page for the first visitor after the revalidation window and caches the result for all subsequent
  visitors.
- **`use cache` / `unstable_cache`:** These directives cannot access `cookies()` or `headers()` directly. If you need to
  cache part of an authenticated page, read cookies outside the cache scope and pass relevant values as arguments.

> **Note:** Next.js caching defaults have changed across versions. For example,
> [Next.js 15 changed `fetch` requests, `GET` Route Handlers, and the client Router Cache to be uncached by default](https://nextjs.org/blog/next-15#caching-semantics),
> reversing the previous opt-out model. Check the [caching guide](https://nextjs.org/docs/app/guides/caching) for your
> specific Next.js version.

**Other SSR frameworks (Remix, Astro, SvelteKit, TanStack Start):** These frameworks do not cache SSR responses by
default. If you add caching headers to improve performance, exclude routes that call `getUser()` or read auth cookies.

## License

MIT
