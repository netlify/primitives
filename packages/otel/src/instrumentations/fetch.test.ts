import { describe, expect, test } from 'vitest'
import { FetchInstrumentation } from './fetch.ts'

describe('header exclusion', () => {
  test('skips configured headers', () => {
    const instrumentation = new FetchInstrumentation({
      skipHeaders: ['authorization'],
    })

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const attributes = instrumentation['prepareHeaders'](
      'request',
      ['a', 'a', 'b', 'b', 'authorization', 'secret'].map((value) => Buffer.from(value)),
    )
    expect(attributes).toEqual({
      'http.request.header.a': 'a',
      'http.request.header.b': 'b',
    })
  })

  test('it skips all headers if so configured', () => {
    const everything = new FetchInstrumentation({
      skipHeaders: true,
    })
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const empty = everything['prepareHeaders'](
      'request',
      ['a', 'a', 'b', 'b', 'authorization', 'secret'].map((value) => Buffer.from(value)),
    )
    expect(empty).toEqual({})
  })

  test('redacts configured headers', () => {
    const instrumentation = new FetchInstrumentation({
      redactHeaders: ['authorization'],
    })

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const attributes = instrumentation['prepareHeaders'](
      'request',
      ['a', 'a', 'b', 'b', 'authorization', 'secret'].map((value) => Buffer.from(value)),
    )
    expect(attributes['http.request.header.authorization']).not.toBe('secret')
    expect(attributes['http.request.header.authorization']).toBeTypeOf('string')
    expect(attributes['http.request.header.a']).toBe('a')
    expect(attributes['http.request.header.b']).toBe('b')
  })

  test('redacts everything if so requested', () => {
    const instrumentation = new FetchInstrumentation({
      redactHeaders: true,
    })

    // eslint-disable-next-line @typescript-eslint/dot-notation
    const attributes = instrumentation['prepareHeaders'](
      'request',
      ['a', 'a', 'b', 'b', 'authorization', 'secret'].map((value) => Buffer.from(value)),
    )
    expect(attributes['http.request.header.authorization']).not.toBe('a secret')
    expect(attributes['http.request.header.a']).not.toBe('a')
    expect(attributes['http.request.header.b']).not.toBe('b')
    expect(attributes['http.request.header.authorization']).toBeTypeOf('string')
    expect(attributes['http.request.header.a']).toBeTypeOf('string')
    expect(attributes['http.request.header.b']).toBeTypeOf('string')
  })
})
