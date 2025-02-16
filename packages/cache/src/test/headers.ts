export const decodeHeaders = (encodedHeader: string | null) => {
  const headers = new Headers()

  if (!encodedHeader) {
    return headers
  }

  const decoded = Buffer.from(encodedHeader, 'base64').toString('utf8')
  const parsed = JSON.parse(decoded) as Record<string, string[]>

  for (const key in parsed) {
    for (const value of parsed[key]) {
      headers.append(key, value)
    }
  }

  return headers
}
