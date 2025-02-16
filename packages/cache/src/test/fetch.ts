interface GetMockFetchOptions {
  responses?: Record<
    string,
    (((input: string | URL | Request, init?: RequestInit) => Response | Error | Promise<Response>) | Response | Error)[]
  >
}

const originalFetch = globalThis.fetch

const getFetchURL = (input: string | URL | Request) => {
  if (input instanceof URL) {
    return input
  }

  return new URL(typeof input === 'string' ? input : input.url)
}

export const getMockFetch = ({ responses = {} }: GetMockFetchOptions = {}) => {
  const requests: Request[] = []

  globalThis.fetch = async (input, init) => {
    requests.push(new Request(input, init))

    const url = getFetchURL(input)
    const mockResponse = (responses[url.href] ?? []).shift()

    if (mockResponse === undefined) {
      throw new Error(`Unexpected fetch call to '${url.href}'`)
    }

    const response = typeof mockResponse === 'function' ? await mockResponse(input, init) : mockResponse

    if (response instanceof Error) {
      throw response
    }

    return response
  }

  return {
    requests,
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}
