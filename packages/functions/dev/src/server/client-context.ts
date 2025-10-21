import { jwtDecode } from 'jwt-decode'

/**
 * Inject a client context based on auth header.
 * Ported over from netlify-lambda (https://github.com/netlify/netlify-lambda/pull/57).
 */
export const buildClientContext = (headers: Record<string, string>) => {
  if (!headers.authorization) return

  const parts = headers.authorization.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return

  const identity = {
    url: 'https://netlify-dev-locally-emulated-identity.netlify.app/.netlify/identity',

    // {
    //   "source": "netlify dev",
    //   "testData": "NETLIFY_DEV_LOCALLY_EMULATED_IDENTITY"
    // }
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzb3VyY2UiOiJuZXRsaWZ5IGRldiIsInRlc3REYXRhIjoiTkVUTElGWV9ERVZfTE9DQUxMWV9FTVVMQVRFRF9JREVOVElUWSJ9.2eSDqUOZAOBsx39FHFePjYj12k0LrxldvGnlvDu3GMI',
  }

  try {
    // This data is available on both the context root and under custom.netlify for retro-compatibility.
    // In the future it will only be available in custom.netlify.
    const user = jwtDecode(parts[1])

    const netlifyContext = JSON.stringify({
      identity,
      user,
    })

    return {
      identity,
      user,
      custom: {
        netlify: Buffer.from(netlifyContext).toString('base64'),
      },
    }
  } catch {
    // Ignore errors - bearer token is not a JWT, probably not intended for us
  }
}
