import { describe, expectTypeOf, test } from 'vitest'

import type { NetlifyFunction } from '../main.js'

describe('NetlifyFunction', () => {
  describe('regular', () => {
    test('requires `fetch` to return a Response', () => {
      expectTypeOf({ fetch: () => new Response('hi'), config: { path: '/hi' } } as const).toExtend<NetlifyFunction>()
      expectTypeOf({ fetch: () => {}, config: { path: '/hi' } } as const).not.toExtend<NetlifyFunction>()
    })

    test('keeps the regular contract with `background: false`', () => {
      expectTypeOf({
        fetch: () => new Response('hi'),
        config: { path: '/hi', background: false },
      } as const).toExtend<NetlifyFunction>()
    })

    test('requires a Response when there is no config', () => {
      expectTypeOf({ fetch: () => new Response('hi') } as const).toExtend<NetlifyFunction>()
    })
  })

  describe('background', () => {
    test('accepts `fetch` returning void or Promise<void>', () => {
      expectTypeOf({ fetch: () => {}, config: { path: '/hi', background: true } } as const).toExtend<NetlifyFunction>()
      expectTypeOf({
        fetch: async () => {},
        config: { path: '/hi', background: true },
      } as const).toExtend<NetlifyFunction>()
    })

    // The runtime discards the response, so a Response return type would be misleading.
    test('rejects `fetch` returning a Response', () => {
      expectTypeOf({
        fetch: () => new Response('hi'),
        config: { path: '/hi', background: true },
      } as const).not.toExtend<NetlifyFunction>()
    })
  })

  test('allows event handlers alongside either variant', () => {
    expectTypeOf({
      fetch: () => new Response('hi'),
      deploySucceeded: () => {},
      config: { path: '/hi' },
    } as const).toExtend<NetlifyFunction>()
    expectTypeOf({
      fetch: () => {},
      deploySucceeded: () => {},
      config: { path: '/hi', background: true },
    } as const).toExtend<NetlifyFunction>()
  })
})
