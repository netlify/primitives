import type { NetlifyAPI } from '@netlify/api'

export interface AIGatewayContext {
  token: string
  url: string
}

export interface AIGatewayConfig {
  api: NetlifyAPI
  env: Record<string, { sources: string[]; value: string }>
  options: { offline?: boolean; offlineEnv?: boolean }
  site: { id?: string }
  siteUrl: string | undefined
}

interface AIGatewayTokenResponse {
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
    const url = `${api.scheme}://${api.host}/api/v1/sites/${siteId}/ai-gateway/token`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${api.accessToken ?? ''}`,
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
  const { api, env, options, site, siteUrl } = config

  if (site.id && site.id !== 'unlinked' && siteUrl && !(options.offline || options.offlineEnv)) {
    const aiGatewayToken = await fetchAIGatewayToken({ api, siteId: site.id })
    if (aiGatewayToken) {
      const aiGatewayPayload = JSON.stringify({
        token: aiGatewayToken.token,
        url: `${siteUrl}/.netlify/ai`,
      })
      const base64Payload = Buffer.from(aiGatewayPayload).toString('base64')
      env.AI_GATEWAY = { sources: ['internal'], value: base64Payload }

      // Also set process env for compatibility
      if (typeof process !== 'undefined') {
        process.env.AI_GATEWAY = base64Payload
      }
    }
  }
}

export const parseAIGatewayContext = (): { token: string; url: string } | undefined => {
  try {
    const aiGatewayEnv = typeof process !== 'undefined' ? process.env.AI_GATEWAY : undefined
    if (aiGatewayEnv) {
      const decodedData = Buffer.from(aiGatewayEnv, 'base64').toString('utf8')
      const aiGatewayData = JSON.parse(decodedData) as { token: string; url: string }
      return { token: aiGatewayData.token, url: aiGatewayData.url }
    }
  } catch {
    // Ignore parsing errors - AI Gateway is optional
  }
  return undefined
}
