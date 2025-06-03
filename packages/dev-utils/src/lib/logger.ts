type logFunction = (message?: string) => void

export type Logger = {
  error: logFunction
  log: logFunction
  warn: logFunction
}
