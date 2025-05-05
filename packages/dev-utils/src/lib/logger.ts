type logFunction = (...message: unknown[]) => void

export type Logger = {
  error: logFunction
  log: logFunction
  warn: logFunction
}
