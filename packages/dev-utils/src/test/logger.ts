import type { Logger } from '../lib/logger.js'

export const createMockLogger = (): Logger => ({
  log: () => {},
  warn: () => {},
  error: () => {},
})
