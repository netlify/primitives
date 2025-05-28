import { type Header } from '@netlify/headers-parser'

/**
 * Get the matching headers for `path` given a set of header rules.
 */
export const headersForPath = function (headerRules: Header[], path: string) {
  const matchingHeaderRules = headerRules.filter(({ forRegExp }) => forRegExp.test(path)).map(({ values }) => values)
  // Return as a single flat object for simplicity
  return matchingHeaderRules.reduce((acc, val) => ({ ...acc, ...val }), {})
}
