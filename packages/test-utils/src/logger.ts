import type { Logger } from '@netlify/dev-utils'

export const createMockLogger = (): Logger => ({
  log: () => {},
  warn: () => {},
  error: () => {},
})
