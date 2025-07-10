import { type SugaredTracer } from '@opentelemetry/api/experimental'
import { GET_TRACER, SHUTDOWN_TRACERS } from './constants.js'

type GlobalThisExtended = typeof globalThis & {
  [GET_TRACER]?: (name?: string, version?: string) => SugaredTracer | undefined
  [SHUTDOWN_TRACERS]?: () => void
}

export const getTracer = (name?: string, version?: string): SugaredTracer | undefined => {
  return (globalThis as GlobalThisExtended)[GET_TRACER]?.(name, version)
}

export const shutdownTracers = async (): Promise<void> => {
  return (globalThis as GlobalThisExtended)[SHUTDOWN_TRACERS]?.()
}
