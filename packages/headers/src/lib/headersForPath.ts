import { type Header } from '@netlify/headers-parser'

/**
 * Get the matching headers for `path` given a set of header rules.
 */
export const headersForPath = function (headers: Header[], path: string) {
  const matchingHeaders = headers.filter(({ forRegExp }) => forRegExp.test(path)).map(({ values }) => values)
  const headersRules = Object.assign({}, ...matchingHeaders)
  return headersRules
}
