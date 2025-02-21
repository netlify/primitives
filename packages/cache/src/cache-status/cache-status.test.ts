import { describe, test, expect } from 'vitest'

import { getCacheStatus, parseCacheStatusValues, parseCacheStatusValue } from './cache-status.js'

describe('`parseCacheStatus`', () => {
  test('Accepts a string with the values of the `cache-status` header', () => {
    expect(getCacheStatus(`"Netlify Durable"; fwd=miss; stored=true; ttl=3600`)).toStrictEqual({
      hit: false,
      caches: {
        durable: {
          fresh: false,
          hit: false,
          stored: true,
          ttl: 3600,
        },
      },
    })
  })

  test('Accepts a `Headers` object', () => {
    const headers = new Headers()
    headers.set('cache-status', `"Netlify Durable"; fwd=miss; stored=true; ttl=3600`)

    expect(getCacheStatus(headers)).toStrictEqual({
      hit: false,
      caches: {
        durable: {
          fresh: false,
          hit: false,
          stored: true,
          ttl: 3600,
        },
      },
    })
  })

  test('Accepts a `Response` object', () => {
    const response = new Response('Hello world', {
      headers: {
        'cache-status': `"Netlify Durable"; fwd=miss; stored=true; ttl=3600`,
      },
    })

    expect(getCacheStatus(response)).toStrictEqual({
      hit: false,
      caches: {
        durable: {
          fresh: false,
          hit: false,
          stored: true,
          ttl: 3600,
        },
      },
    })
  })

  test('Throws if the input is of an unsupported type', () => {
    // @ts-expect-error Wrong type
    expect(() => getCacheStatus({})).toThrow()
  })
})

describe('`parseCacheStatusValue`', () => {
  test('Extracts the name of the cache and any attributes', () => {
    expect(parseCacheStatusValue(`"Netlify Durable"; hit; ttl=1234`)).toStrictEqual({
      attributes: { hit: '', ttl: '1234' },
      name: 'netlify durable',
    })

    expect(parseCacheStatusValue(`"Netlify Durable"; fwd=miss`)).toStrictEqual({
      attributes: { fwd: 'miss' },
      name: 'netlify durable',
    })

    expect(parseCacheStatusValue(`"Netlify Edge"`)).toStrictEqual({
      attributes: {},
      name: 'netlify edge',
    })
  })

  test('Extracts the cache name even if it does not have wrapping quotes', () => {
    expect(parseCacheStatusValue(`something`)).toStrictEqual({
      attributes: {},
      name: 'something',
    })
  })
})

describe('`parseCacheStatusValues`', () => {
  test('Ignores non-Netlify caches', () => {
    expect(parseCacheStatusValues('ExampleCache; hit; detail=MEMORY')).toBeNull()

    expect(parseCacheStatusValues(`ExampleCache; hit; detail=MEMORY,"Netlify Durable"; fwd=miss`)).toStrictEqual({
      hit: false,
      caches: {
        durable: {
          fresh: false,
          hit: false,
          stored: false,
          ttl: 0,
        },
      },
    })
  })

  test('Handles a single Netlify cache', () => {
    expect(parseCacheStatusValues(`"Netlify Durable"; fwd=miss; stored=true; ttl=3600`)).toStrictEqual({
      hit: false,
      caches: {
        durable: {
          fresh: false,
          hit: false,
          stored: true,
          ttl: 3600,
        },
      },
    })

    expect(parseCacheStatusValues(`"Netlify Edge"; hit`)).toStrictEqual({
      hit: true,
      caches: {
        edge: {
          fresh: true,
          hit: true,
        },
      },
    })
  })

  test('Handles multiple Netlify caches', () => {
    expect(
      parseCacheStatusValues(`"Netlify Edge"; hit,"Netlify Durable"; fwd=miss; stored=true; ttl=3600`),
    ).toStrictEqual({
      hit: true,
      caches: {
        durable: {
          fresh: false,
          hit: false,
          stored: true,
          ttl: 3600,
        },
        edge: {
          fresh: true,
          hit: true,
        },
      },
    })

    expect(
      parseCacheStatusValues(`"Netlify Edge"; fwd=stale,"Netlify Durable"; fwd=miss; stored=true; ttl=3600`),
    ).toStrictEqual({
      hit: false,
      caches: {
        durable: {
          fresh: false,
          hit: false,
          stored: true,
          ttl: 3600,
        },
        edge: {
          fresh: false,
          hit: false,
        },
      },
    })
  })
})
