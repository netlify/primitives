import { assertType, describe, expectTypeOf, test } from 'vitest'

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

  test('accepts `access` with `path`', () => {
    assertType<Config>({ path: '/x', access: 'public' })
    assertType<Config>({ path: '/x/*', access: { '/x/hooks': 'public' } })
  })

  test('rejects `access` values other than `public`', () => {
    expectTypeOf({ path: '/x', access: 'private' } as const).not.toExtend<Config>()
    expectTypeOf({ path: '/x/*', access: { '/x/hooks': 'private' } } as const).not.toExtend<Config>()
  })

  test('rejects `access` paths without a leading slash', () => {
    // @ts-expect-error paths must begin with a forward slash
    assertType<Config>({ path: '/x/*', access: { 'x/hooks': 'public' } })
  })

  test('accepts `public` without `path`', () => {
    assertType<Config>({ access: 'public' })
  })

  test('rejects the map form of `access` without `path`', () => {
    // @ts-expect-error the map form needs `path`
    assertType<Config>({ access: { '/x': 'public' } })
    // @ts-expect-error the map form needs `path`
    assertType<Config>({ excludedPath: '/x', access: { '/x': 'public' } })
  })

  test('rejects `access` on a scheduled function', () => {
    // @ts-expect-error a scheduled function cannot set `access`
    assertType<Config>({ schedule: '5 4 * * *', access: 'public' })
    expectTypeOf({ schedule: '5 4 * * *', access: 'public' } as const).not.toExtend<Config>()
  })
})
