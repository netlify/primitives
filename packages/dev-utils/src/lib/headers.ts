export const headers = {
  BlobsInfo: 'x-nf-blobs-info',
}

export const toMultiValueHeaders = (headers: Headers) => {
  const headersObj: Record<string, string[]> = {}
  for (const [name, value] of headers.entries()) {
    if (name in headersObj) {
      headersObj[name].push(value)
    } else {
      headersObj[name] = [value]
    }
  }

  return headersObj
}
