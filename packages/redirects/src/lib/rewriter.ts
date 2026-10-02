import path from 'node:path'

import { toMultiValueHeaders } from '@netlify/dev-utils'
import { parseCookie } from 'cookie'
import { createMatcher, type Matcher, type MatchResult } from '@netlify/redirect-matcher'

import { parseRedirects } from './parser.js'
import { Redirect } from './redirect.js'

export type Rewriter = (req: Request) => Promise<MatchResult | null>

const REDIRECTS_FILE_NAME = '_redirects'

const getLanguage = (acceptLanguage: string | null) => {
  if (acceptLanguage) {
    return acceptLanguage.split(',')[0].slice(0, 2)
  }

  return 'en'
}

export const createRewriter = async function ({
  configPath,
  configRedirects,
  geoCountry,
  ignoreSPARedirect = false,
  jwtRoleClaim,
  jwtSecret,
  projectDir,
  publicDir,
}: {
  configPath?: string | undefined
  configRedirects: Redirect[]
  geoCountry?: string | undefined
  ignoreSPARedirect?: boolean
  jwtRoleClaim: string
  jwtSecret: string
  projectDir: string
  publicDir?: string | undefined
}): Promise<Rewriter> {
  let matcher: Matcher | null = null
  const redirectsFiles = [
    ...new Set([path.resolve(publicDir ?? '', REDIRECTS_FILE_NAME), path.resolve(projectDir, REDIRECTS_FILE_NAME)]),
  ]
  let redirects = await parseRedirects({ configRedirects, redirectsFiles, configPath })

  // Hacky solution: Filter out the SPA redirect pattern when requested.
  // This prevents the redirect from interfering with local dev servers like Vite,
  // while still allowing it to work in production.
  // See: https://github.com/netlify/primitives/issues/325
  if (ignoreSPARedirect) {
    redirects = redirects.filter((redirect) => {
      // Filter out redirects that match the SPA pattern: from "/*" to "/index.html" with status 200
      // See https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/#history-pushstate-and-single-page-apps,
      const isSPARedirect = redirect.origin === '/*' && redirect.to === '/index.html' && redirect.status === 200

      return !isSPARedirect
    })
  }

  const getMatcher = async (): Promise<Pick<Matcher, 'match'>> => {
    if (matcher) return matcher

    // Without rules, skip compiling the matcher's WebAssembly module.
    if (redirects.length === 0) {
      return { match: () => null }
    }

    matcher = await createMatcher(redirects, { jwtSecret, jwtRoleClaim })
    if (matcher.parseErrors.length !== 0) {
      console.log(`Redirects matcher errors:\n${matcher.parseErrors.map(({ message }) => message).join('\n\n')}`)
    }
    return matcher
  }

  return async function rewriter(req: Request): Promise<MatchResult | null> {
    const matcherFunc = await getMatcher()
    const reqUrl = new URL(req.url)
    const cookieValues = parseCookie(req.headers.get('cookie') || '')
    const headers: Record<string, string | string[]> = {
      'x-language': cookieValues.nf_lang || getLanguage(req.headers.get('accept-language')),
      'x-country': cookieValues.nf_country || geoCountry || 'us',
      ...toMultiValueHeaders(req.headers),
    }

    return matcherFunc.match({
      scheme: reqUrl.protocol.replace(/:.*$/, ''),
      host: reqUrl.hostname,
      path: decodeURIComponent(reqUrl.pathname),
      query: reqUrl.search.slice(1),
      headers,
      cookies: cookieValues,
    })
  }
}
