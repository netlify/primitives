import { expectTypeOf, test } from 'vitest'

import { onHealthCheck, type Config, type HealthCheckHook } from './main.js'

test('Config takes one path or several, each starting with a slash', () => {
  expectTypeOf({ path: '/api/*' as const }).toExtend<Config>()
  expectTypeOf({ path: ['/api/*', '/health'] as ['/api/*', '/health'] }).toExtend<Config>()
  expectTypeOf({ path: 'api/*' as const }).not.toExtend<Config>()
})

test('Config takes only the regions servers run in', () => {
  expectTypeOf({ region: 'iad' as const }).toExtend<Config>()
  expectTypeOf({ region: 'sfo' as const }).not.toExtend<Config>()
})

test('Health check hooks return a report, or nothing, synchronously or not', () => {
  expectTypeOf(() => ({ utilization: { db_pool: 0.4 } })).toExtend<HealthCheckHook>()
  expectTypeOf(() =>
    Promise.resolve({ applicationUtilization: 0.5, namedMetrics: { waiting: 2 } }),
  ).toExtend<HealthCheckHook>()
  expectTypeOf(() => ({ utilization: 0.4 })).not.toExtend<HealthCheckHook>()
  expectTypeOf(() => ({ namedMetrics: { waiting: '2' } })).not.toExtend<HealthCheckHook>()

  // Passed straight to `onHealthCheck`, a hook can have no return statement.
  expectTypeOf(onHealthCheck).toBeCallableWith(() => {})
  expectTypeOf(onHealthCheck).toBeCallableWith(async () => {
    await Promise.resolve()
  })
})
