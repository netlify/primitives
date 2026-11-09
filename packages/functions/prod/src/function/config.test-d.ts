import { describe, expectTypeOf, test } from 'vitest'

import type { Config } from '../main.js'

describe('Config', () => {
  test('accepts `memory` alone', () => {
    expectTypeOf({ path: '/x', memory: 2048 } as const).toExtend<Config>()
    expectTypeOf({ path: '/x', memory: '2gb' } as const).toExtend<Config>()
  })

  test('accepts `vcpu` alone', () => {
    expectTypeOf({ path: '/x', vcpu: 1.5 } as const).toExtend<Config>()
    expectTypeOf({ schedule: '5 4 * * *', vcpu: 1 } as const).toExtend<Config>()
  })

  test('accepts neither `memory` nor `vcpu`', () => {
    expectTypeOf({ path: '/x' } as const).toExtend<Config>()
  })

  test('rejects both `memory` and `vcpu`', () => {
    expectTypeOf({ path: '/x', memory: 2048, vcpu: 1.5 } as const).not.toExtend<Config>()
    expectTypeOf({ schedule: '5 4 * * *', memory: '2gb', vcpu: 1 } as const).not.toExtend<Config>()
  })

  test('accepts `background`', () => {
    expectTypeOf({ path: '/x', background: true } as const).toExtend<Config>()
    expectTypeOf({ path: '/x', background: false } as const).toExtend<Config>()
    expectTypeOf({ path: '/x', background: true, vcpu: 1.5 } as const).toExtend<Config>()
  })
})
