import { type Logger as ViteLogger } from 'vite'
import type { Logger } from '@netlify/dev-utils'
import ansis from 'ansis'

const NETLIFY_CYAN = ansis.rgb(40, 180, 170)
// There is an intentional half-width space here to work around a unicode rendering
// issue in some terminals
const banner = NETLIFY_CYAN('⬥ Netlify ⬥')

export const createLoggerFromViteLogger = (viteLogger: ViteLogger): Logger => ({
  error: (msg?: string) => viteLogger.error(msg ?? '', { timestamp: true, environment: banner }),
  log: (msg?: string) => viteLogger.info(msg ?? '', { timestamp: true, environment: banner }),
  warn: (msg?: string) => viteLogger.warn(msg ?? '', { timestamp: true, environment: banner }),
})
