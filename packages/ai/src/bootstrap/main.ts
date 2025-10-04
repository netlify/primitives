import type { NetlifyAPI } from '@netlify/api'

export interface AIGatewayContext {
  token: string
  url: string
}

export interface AIGatewayConfig {
  api: NetlifyAPI
  env: Record<string, { sources: string[]; value: string }>
  siteID: string | undefined
  siteURL: string | undefined
  existingToken?: string
}

export interface AIProviderEnvVar {
  key: string
  url: string
}

export interface AIGatewayTokenResponse {
  token: string
  url: string
  envVars?: AIProviderEnvVar[]
}

export interface AIProvider {
  token_env_var: string
  url_env_var: string
  models: string[]
}

export interface ProvidersResponse {
  providers: Record<string, AIProvider>
}

const isValidTokenResponse = (data: unknown): data is AIGatewayTokenResponse => {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as Record<string, unknown>).token === 'string' &&
    typeof (data as Record<string, unknown>).url === 'string'
  )
}

const isValidProvidersResponse = (data: unknown): data is ProvidersResponse => {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as Record<string, unknown>).providers === 'object' &&
    (data as Record<string, unknown>).providers !== null
  )
}

export const fetchAIProviders = async ({ api }: { api: NetlifyAPI }): Promise<AIProviderEnvVar[]> => {
  try {
    if (!api.accessToken) {
      return []
    }

    const url = `${api.scheme}://${api.host}/api/v1/ai-gateway/providers`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${api.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return []
      }
      throw new Error(`HTTP ${String(response.status)}: ${response.statusText}`)
    }

    const data: unknown = await response.json()

    if (!isValidProvidersResponse(data)) {
      throw new Error('Invalid providers response format')
    }

    const envVars: AIProviderEnvVar[] = []

    for (const provider of Object.values(data.providers)) {
      envVars.push({
        key: provider.token_env_var,
        url: provider.url_env_var,
      })
    }

    return envVars
  } catch (error) {
    console.warn(`Failed to fetch AI providers: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

export const fetchAIGatewayToken = async ({
  api,
  siteId,
  priorAuthToken,
}: {
  api: NetlifyAPI
  siteId: string
  priorAuthToken?: string
}): Promise<AIGatewayTokenResponse | null> => {
  try {
    if (!api.accessToken) {
      return null
    }

    // TODO: update once available in openApi
    const url = `${api.scheme}://${api.host}/api/v1/sites/${siteId}/ai-gateway/token`

    const headers: Record<string, string> = {
      Authorization: `Bearer ${api.accessToken}`,
      'Content-Type': 'application/json',
    }

    if (priorAuthToken) {
      headers['X-Prior-Authorization'] = priorAuthToken
    }

    const response = await fetch(url, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`HTTP ${String(response.status)}: ${response.statusText}`)
    }

    const data: unknown = await response.json()

    if (!isValidTokenResponse(data)) {
      throw new Error('Invalid response: missing token or url')
    }

    return {
      token: data.token,
      url: data.url,
    }
  } catch (error) {
    console.warn(
      `Failed to fetch AI Gateway token for site ${siteId}: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}

export const setupAIGateway = async (config: AIGatewayConfig): Promise<{ token: string; url: string } | null> => {
  const { api, env, siteID, siteURL, existingToken } = config

  if (siteID && siteID !== 'unlinked' && siteURL) {
    let priorAuthToken: string | undefined

    // If existingToken is explicitly provided (even if empty string), use it
    if (existingToken !== undefined) {
      priorAuthToken = existingToken || undefined
    } else {
      // If no existingToken provided, extract existing AI_GATEWAY from process.env to check for prior auth token
      const existingAIGateway = parseAIGatewayContext(process.env.AI_GATEWAY)
      // If there's an existing AI Gateway context with the same URL, use its token as prior auth
      if (existingAIGateway && existingAIGateway.url === `${siteURL}/.netlify/ai`) {
        priorAuthToken = existingAIGateway.token
      }
    }

    const [aiGatewayToken, envVars] = await Promise.all([
      fetchAIGatewayToken({ api, siteId: siteID, priorAuthToken }),
      fetchAIProviders({ api }),
    ])

    if (aiGatewayToken) {
      const aiGatewayContext = JSON.stringify({
        token: aiGatewayToken.token,
        url: `${siteURL}/.netlify/ai`,
        envVars,
      })
      const base64Context = Buffer.from(aiGatewayContext).toString('base64')
      env.AI_GATEWAY = { sources: ['internal'], value: base64Context }

      return {
        token: aiGatewayToken.token,
        url: `${siteURL}/.netlify/ai`,
      }
    }
  }

  return null
}

export const parseAIGatewayContext = (aiGatewayValue?: string): AIGatewayTokenResponse | undefined => {
  try {
    if (aiGatewayValue) {
      const decodedContext = Buffer.from(aiGatewayValue, 'base64').toString('utf8')
      const aiGatewayContext = JSON.parse(decodedContext) as AIGatewayTokenResponse
      return aiGatewayContext
    }
  } catch {
    // Ignore parsing errors - AI Gateway is optional
  }
  return undefined
}
