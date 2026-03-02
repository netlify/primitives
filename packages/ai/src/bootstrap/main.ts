import type { NetlifyAPI } from '@netlify/api'

export interface AIGatewayContext {
  token: string
  url: string
}

export interface AIGatewayConfig {
  api: NetlifyAPI
  env: Record<string, { sources: string[]; value: string }>
  siteID?: string | undefined
  siteURL?: string | undefined
  accountID?: string | undefined
  /** Whether the site has a published deploy. When false, site-scoped tokens are skipped. */
  siteHasDeploy?: boolean | undefined
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

export const fetchAIProviders = async ({ api }: { api: NetlifyAPI }): Promise<AIProviderEnvVar[]> => {
  try {
    if (!api.accessToken) {
      return []
    }

    const data = await api.getAIGatewayProviders()

    if (!data.providers) {
      return []
    }

    const envVars: AIProviderEnvVar[] = []

    for (const provider of Object.values(data.providers)) {
      if (provider.token_env_var && provider.url_env_var) {
        envVars.push({
          key: provider.token_env_var,
          url: provider.url_env_var,
        })
      }
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
}: {
  api: NetlifyAPI
  siteId: string
}): Promise<AIGatewayTokenResponse | null> => {
  try {
    if (!api.accessToken) {
      return null
    }

    const data = await api.getAIGatewayToken({ site_id: siteId })

    if (!data.token || !data.url) {
      return null
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

export const fetchAccountAIGatewayToken = async ({
  api,
  accountId,
}: {
  api: NetlifyAPI
  accountId: string
}): Promise<AIGatewayTokenResponse | null> => {
  try {
    if (!api.accessToken) {
      return null
    }

    const data = await api.getAccountAIGatewayToken({ account_id: accountId })

    if (!data.token || !data.url) {
      return null
    }

    return {
      token: data.token,
      url: data.url,
    }
  } catch (error) {
    console.warn(
      `Failed to fetch AI Gateway token for account ${accountId}: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}

export const setupAIGateway = async (config: AIGatewayConfig): Promise<void> => {
  const { api, env, siteID, siteURL, accountID, siteHasDeploy = true } = config

  let aiGatewayToken: AIGatewayTokenResponse | null = null
  let tokenSource: 'site' | 'account' | null = null

  // Try site-scoped token first (only if site has a published deploy)
  if (siteID && siteID !== 'unlinked' && siteURL && siteHasDeploy) {
    aiGatewayToken = await fetchAIGatewayToken({ api, siteId: siteID })
    if (aiGatewayToken) tokenSource = 'site'
  }

  // Fall back to account-scoped token
  if (!aiGatewayToken && accountID) {
    aiGatewayToken = await fetchAccountAIGatewayToken({ api, accountId: accountID })
    if (aiGatewayToken) tokenSource = 'account'
  }

  if (aiGatewayToken) {
    const envVars = await fetchAIProviders({ api })
    const aiGatewayContext = JSON.stringify({
      token: aiGatewayToken.token,
      url: tokenSource === 'site' && siteURL ? `${siteURL}/.netlify/ai` : aiGatewayToken.url,
      envVars,
    })
    const base64Context = Buffer.from(aiGatewayContext).toString('base64')
    env.AI_GATEWAY = { sources: ['internal'], value: base64Context }
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
