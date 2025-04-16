import path from 'node:path'

import { toMultiValueHeaders } from '@netlify/dev-utils'
import cookie from 'cookie'
import redirector, { type Match, type RedirectMatcher } from 'netlify-redirector'

import { parseRedirects } from './parser.js'
import { Redirect } from './redirect.js'

export type Rewriter = (req: Request) => Promise<Match | null>

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
  jwtRoleClaim,
  jwtSecret,
  projectDir,
  publicDir,
}: {
  configPath?: string | undefined
  configRedirects: Redirect[]
  geoCountry?: string | undefined
  jwtRoleClaim: string
  jwtSecret: string
  projectDir: string
  publicDir?: string | undefined
}): Promise<Rewriter> {
  let matcher: RedirectMatcher | null = null
  const redirectsFiles = [
    ...new Set([path.resolve(publicDir ?? '', REDIRECTS_FILE_NAME), path.resolve(projectDir, REDIRECTS_FILE_NAME)]),
  ]
  const redirects = await parseRedirects({ configRedirects, redirectsFiles, configPath })

  const getMatcher = async (): Promise<RedirectMatcher> => {
    if (matcher) return matcher

    if (redirects.length !== 0) {
      return (matcher = await redirector.parseJSON(JSON.stringify(redirects), {
        jwtSecret,
        jwtRoleClaim,
      }))
    }
    return {
      match() {
        return null
      },
    }
  }

  return async function rewriter(req: Request): Promise<Match | null> {
    const matcherFunc = await getMatcher()
    const reqUrl = new URL(req.url)
    const cookieValues = cookie.parse(req.headers.get('cookie') || '')
    const headers: Record<string, string | string[]> = {
      'x-language': cookieValues.nf_lang || getLanguage(req.headers.get('accept-language')),
      'x-country': cookieValues.nf_country || geoCountry || 'us',
      ...toMultiValueHeaders(req.headers),
    }

    // Definition: https://github.com/netlify/libredirect/blob/e81bbeeff9f7c260a5fb74cad296ccc67a92325b/node/src/redirects.cpp#L28-L60
    const matchReq = {
      scheme: reqUrl.protocol.replace(/:.*$/, ''),
      host: reqUrl.hostname,
      path: decodeURIComponent(reqUrl.pathname),
      query: reqUrl.search.slice(1),
      headers,
      cookieValues,
      getHeader: (name: string) => {
        const val = headers[name.toLowerCase()]
        if (Array.isArray(val)) {
          return val[0]
        }
        return val || ''
      },
      getCookie: (key: string) => cookieValues[key] || '',
    }

    return matcherFunc.match(matchReq)
  }
}
