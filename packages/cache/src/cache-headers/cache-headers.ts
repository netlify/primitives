import * as HEADERS from '../headers.js'
import { CacheSettings, VaryOptions } from './options.js'
import {
  ensureArray,
  requireArrayOfStrings,
  requireArrayOfStringsWithNesting,
  requirePositiveInteger,
} from './validation.js'

export const ONE_YEAR = 60 * 24 * 365

export const cacheHeaders = (cacheSettings: CacheSettings) => {
  const { durable, overrideDeployRevalidation: id, tags, ttl, swr, vary } = cacheSettings
  const headers: Record<string, string> = {}
  const cacheControlDirectives: string[] = []

  if (ttl) {
    const ttlValue = requirePositiveInteger('ttl', ttl)

    if (ttlValue > 0) {
      cacheControlDirectives.push(`s-maxage=${ttlValue}`)
    }
  }

  if (swr) {
    // Accept the bare stale-while-revalidate directive and set to one year.
    const swrValue = swr === true ? ONE_YEAR : requirePositiveInteger('swr', swr)

    if (swrValue > 0) {
      cacheControlDirectives.push(`stale-while-revalidate=${swrValue}`)
    }
  }

  if (cacheControlDirectives.length > 0) {
    if (durable) {
      cacheControlDirectives.push('durable')
    }

    headers[HEADERS.NetlifyCdnCacheControl] = cacheControlDirectives.join(',')
  }

  if (tags) {
    headers[HEADERS.NetlifyCacheTag] = requireArrayOfStrings('tags', tags).join(',')
  }

  const netlifyVary = getNetlifyVary(vary)

  if (netlifyVary) {
    headers[HEADERS.NetlifyVary] = netlifyVary
  }

  if (id) {
    headers[HEADERS.NetlifyCacheId] = requireArrayOfStrings('id', ensureArray(id)).join(',')
  }

  return headers
}

const getNetlifyVary = (varyOptions?: VaryOptions) => {
  if (!varyOptions) {
    return null
  }

  const { cookie, country, header, language, query } = varyOptions
  const directives: string[] = []

  if (cookie) {
    directives.push(`cookie=${requireArrayOfStrings('cookie', ensureArray(cookie)).join('|')}`)
  }

  if (country) {
    directives.push(`country=${requireArrayOfStringsWithNesting('country', ensureArray(country), '+').join('|')}`)
  }

  if (header) {
    directives.push(`header=${requireArrayOfStrings('header', ensureArray(header)).join('|')}`)
  }

  if (language) {
    directives.push(`language=${requireArrayOfStringsWithNesting('language', ensureArray(language), '+').join('|')}`)
  }

  if (query) {
    if (query === true) {
      directives.push(`query`)
    } else {
      directives.push(`query=${requireArrayOfStrings('query', ensureArray(query)).join('|')}`)
    }
  }

  if (directives.length === 0) {
    return null
  }

  return directives.join(',')
}

export const applyHeaders = (subject: Headers, headersObject: Record<string, string>) => {
  for (const name in headersObject) {
    if (name === HEADERS.NetlifyCdnCacheControl) {
      subject.set(name, headersObject[name])
    } else {
      subject.append(name, headersObject[name])
    }
  }
}

export const setCacheHeaders = (response: Response, cacheSettings: CacheSettings): Response => {
  if (!(response instanceof Response)) {
    throw new TypeError('Input must be a Response object.')
  }

  const newResponse = new Response(response.body, response)

  applyHeaders(newResponse.headers, cacheHeaders(cacheSettings))

  return newResponse
}
