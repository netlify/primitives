import { type Logger as ViteLogger } from 'vite'
import type { Logger } from '@netlify/dev-utils'
import { netlifyBanner } from '@netlify/dev-utils'

export const createLoggerFromViteLogger = (viteLogger: ViteLogger): Logger => ({
  error: (msg?: string) => viteLogger.error(msg ?? '', { timestamp: true, environment: netlifyBanner }),
  log: (msg?: string) => viteLogger.info(msg ?? '', { timestamp: true, environment: netlifyBanner }),
  warn: (msg?: string) => viteLogger.warn(msg ?? '', { timestamp: true, environment: netlifyBanner }),
})

export type { Logger }
