import type { NetlifyAPI } from '@netlify/api'
import process from 'node:process'

export interface AIGatewayContext {
  token: string
  url: string
}

export interface AIGatewayConfig {
  api: NetlifyAPI
  env: Record<string, { sources: string[]; value: string }>
  siteId: string | undefined
  siteUrl: string | undefined
}

export interface AIGatewayTokenResponse {
  token: string
  url: string
}

const isValidTokenResponse = (data: unknown): data is AIGatewayTokenResponse => {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as Record<string, unknown>).token === 'string' &&
    typeof (data as Record<string, unknown>).url === 'string'
  )
}

export const fetchAIGatewayToken = async ({
  api,
  siteId,
}: {
  api: NetlifyAPI
  siteId: string
}): Promise<AIGatewayTokenResponse | null> => {
  try {
    if (!api.accessToken) {
      return null
    }

    // TODO: update once available in openApi
    const url = `${api.scheme}://${api.host}/api/v1/sites/${siteId}/ai-gateway/token`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${api.accessToken}`,
        'Content-Type': 'application/json',
      },
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

export const setupAIGateway = async (config: AIGatewayConfig): Promise<void> => {
  const { api, env, siteId, siteUrl } = config

  if (siteId && siteId !== 'unlinked' && siteUrl) {
    const aiGatewayToken = await fetchAIGatewayToken({ api, siteId })
    if (aiGatewayToken) {
      const aiGatewayContext = JSON.stringify({
        token: aiGatewayToken.token,
        url: `${siteUrl}/.netlify/ai`,
      })
      const base64Context = Buffer.from(aiGatewayContext).toString('base64')
      env.AI_GATEWAY = { sources: ['internal'], value: base64Context }
    }
  }
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
