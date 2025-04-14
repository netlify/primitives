// Should be equivalent to https://github.com/netlify/proxy/blob/main/pkg/functions/request.go#L105.
const exceptionsList = new Set([
  'application/csp-report',
  'application/graphql',
  'application/json',
  'application/javascript',
  'application/x-www-form-urlencoded',
  'application/x-ndjson',
  'application/xml',
])

export const shouldBase64Encode = (contentType: string) => {
  if (!contentType) {
    return true
  }

  const [contentTypeSegment] = contentType.split(';')
  contentType = contentTypeSegment
  contentType = contentType.toLowerCase()

  if (contentType.startsWith('text/')) {
    return false
  }

  if (contentType.endsWith('+json') || contentType.endsWith('+xml')) {
    return false
  }

  if (exceptionsList.has(contentType)) {
    return false
  }

  return true
}
