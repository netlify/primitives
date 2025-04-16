import { parseAllRedirects } from '@netlify/redirect-parser'

import type { Redirect } from './redirect.js'

// TODO: Type in `@netlify/redirect-parser`.
interface ParsedRedirects {
  errors: { message: string }[]
  redirects: Redirect[]
}

// Parse, normalize and validate all redirects from `_redirects` files
// and `netlify.toml`
export const parseRedirects = async function ({
  configRedirects = [],
  configPath,
  redirectsFiles,
}: {
  configRedirects?: Redirect[]
  configPath?: string
  redirectsFiles: string[]
}) {
  const parsed = (await parseAllRedirects({
    redirectsFiles,
    netlifyConfigPath: configPath,
    minimal: false,

    // @ts-expect-error TODO: Fix this type in `@netlify/redirect-parser`.
    configRedirects,
  })) as ParsedRedirects

  handleRedirectParsingErrors(parsed.errors)

  return parsed.redirects.map(normalizeRedirect)
}

const handleRedirectParsingErrors = (errors: ParsedRedirects['errors']) => {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(({ message }: { message: string }) => message).join('\n\n')

  console.log(`Redirects syntax errors:\n${errorMessage}`)
}

// `netlify-redirector` does not handle the same shape as the backend:
//  - `from` is called `origin`
//  - `query` is called `params`
//  - `conditions.role|country|language` are capitalized
const normalizeRedirect = function (input: Redirect) {
  const { conditions, from, query, signed, ...redirect } = input

  return {
    ...redirect,
    origin: from,
    params: query,
    conditions,
    ...(signed && {
      sign: {
        jwt_secret: signed,
      },
    }),
  }
}
