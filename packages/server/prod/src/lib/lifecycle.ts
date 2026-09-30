export type LifecycleHook = () => void | Promise<void>

/**
 * What a health check hook reports. Every field is optional.
 */
export interface HealthReport {
  /**
   * How busy each resource is, as a fraction of its capacity from 0 to 1. The
   * keys are names you choose for your app's own resources, as many as you
   * need, such as `db_pool` or `job_queue`. The platform routes requests and
   * starts instances based on the highest entry. `event_loop` and `memory` are
   * reserved for the platform's own readings.
   */
  utilization?: Record<string, number>

  /**
   * Replaces the overall utilization, which is otherwise the highest
   * `utilization` entry. If several hooks set it, the highest value wins.
   */
  applicationUtilization?: number

  /**
   * Values recorded for observability, such as a queue's length or a latency
   * in milliseconds. Unlike `utilization`, they don't affect routing or
   * scaling.
   */
  namedMetrics?: Record<string, number>
}

export type HealthCheckHook = (() => HealthReport | undefined | Promise<HealthReport | undefined>) | LifecycleHook

export interface HealthCheckOptions {
  /**
   * How often the hook is called, in milliseconds. Defaults to 1000, which is
   * also the minimum.
   */
  interval?: number
}

interface HealthCheckRegistration {
  hook: HealthCheckHook
  interval: number
}

interface Lifecycle {
  start: LifecycleHook[]
  shutdown: LifecycleHook[]
  health: HealthCheckRegistration[]
  started: boolean
}

const MIN_HEALTH_CHECK_INTERVAL_MS = 1000

// The platform reads the hooks from this object and sets `started` once the
// start hooks have resolved. The key is part of the contract with the platform
// and must not change.
const LIFECYCLE_KEY = Symbol.for('@netlify/server/lifecycle')

const getLifecycle = (): Lifecycle => {
  const globalRef = globalThis as Record<symbol, Lifecycle | undefined>

  globalRef[LIFECYCLE_KEY] ??= { start: [], shutdown: [], health: [], started: false }

  return globalRef[LIFECYCLE_KEY]
}

const assertHook = (name: string, hook: unknown) => {
  if (typeof hook !== 'function') {
    throw new TypeError(`${name}() expects a function, got ${typeof hook}.`)
  }
}

/**
 * Registers a hook that runs when an instance starts, after the entry file is
 * imported and before the instance receives traffic. The instance waits for it,
 * and fails to start if it throws.
 *
 * Hooks run one at a time, in the order they were registered. Registering one
 * after the instance has started throws, since it would never run.
 */
export const onStart = (hook: LifecycleHook): void => {
  assertHook('onStart', hook)

  const lifecycle = getLifecycle()

  if (lifecycle.started) {
    throw new Error('onStart() was called after the server started. Register start hooks while the server loads.')
  }

  lifecycle.start.push(hook)
}

/**
 * Registers a hook that runs when an instance is shutting down, after it stops
 * receiving traffic. Use it to close connections and flush buffers.
 *
 * Hooks run one at a time, in the order they were registered. A hook that
 * throws is logged, and the ones after it still run. They share a grace
 * period, and the instance stops when it runs out.
 */
export const onShutdown = (hook: LifecycleHook): void => {
  assertHook('onShutdown', hook)

  getLifecycle().shutdown.push(hook)
}

/**
 * Registers a hook that reports how busy the instance is, which the platform
 * uses to route requests and start instances. The event loop and memory are
 * measured already; use a hook for resources only your code knows about, such
 * as a connection pool or a job queue.
 *
 * The hook can be synchronous or asynchronous, and is called at most once per
 * `interval`. A hook that throws or returns nothing contributes nothing, and
 * never marks the instance unhealthy.
 */
export const onHealthCheck = (hook: HealthCheckHook, options: HealthCheckOptions = {}): void => {
  assertHook('onHealthCheck', hook)

  const { interval = MIN_HEALTH_CHECK_INTERVAL_MS } = options

  if (!Number.isFinite(interval) || interval < MIN_HEALTH_CHECK_INTERVAL_MS) {
    throw new RangeError(
      `onHealthCheck() expects an interval of at least ${String(MIN_HEALTH_CHECK_INTERVAL_MS)} milliseconds, got ${String(interval)}.`,
    )
  }

  getLifecycle().health.push({ hook, interval })
}
