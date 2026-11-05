import { describe, expectTypeOf, test } from 'vitest'

import type { BackgroundHandler, Handler } from '../main.js'

describe('Handler', () => {
  test('rejects async handlers that return void', () => {
    expectTypeOf(async () => {}).not.toExtend<Handler>()
  })
})

describe('BackgroundHandler', () => {
  test('accepts async handlers that return void', () => {
    expectTypeOf(async () => {}).toExtend<BackgroundHandler>()
  })
})
