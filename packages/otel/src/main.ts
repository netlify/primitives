import { type SugaredSpanOptions, type SugaredTracer } from '@opentelemetry/api/experimental'
import { GET_TRACER, SHUTDOWN_TRACERS } from './constants.js'
import type { Context, Span } from '@opentelemetry/api'

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

export function withActiveSpan<F extends (span?: Span) => ReturnType<F>>(
  tracer: SugaredTracer | undefined,
  name: string,
  fn: F,
): ReturnType<F>
export function withActiveSpan<F extends (span?: Span) => ReturnType<F>>(
  tracer: SugaredTracer | undefined,
  name: string,
  options: SugaredSpanOptions,
  fn: F,
): ReturnType<F>
export function withActiveSpan<F extends (span?: Span) => ReturnType<F>>(
  tracer: SugaredTracer | undefined,
  name: string,
  options: SugaredSpanOptions,
  context: Context,
  fn: F,
): ReturnType<F>
export function withActiveSpan<F extends (span?: Span) => ReturnType<F>>(
  tracer: SugaredTracer | undefined,
  name: string,
  optionsOrFn: SugaredSpanOptions | F,
  contextOrFn?: Context | F,
  fn?: F,
): ReturnType<F> {
  const func = typeof contextOrFn === 'function' ? contextOrFn : typeof optionsOrFn === 'function' ? optionsOrFn : fn
  if (!func) {
    throw new Error('function to execute with active span is missing')
  }
  if (!tracer) {
    return func()
  }
  return tracer.withActiveSpan(name, optionsOrFn as SugaredSpanOptions, contextOrFn as Context, func)
}
