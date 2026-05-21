import { describe, expect, test } from 'vitest'
import type { Context } from '@netlify/types'

import { contextStore } from './context_store.js'
import { getContext } from './get_context.js'

const mockContext = { requestId: 'test-request-123' } as unknown as Context

describe('getContext', () => {
  test('returns the context when called from within a request scope', () => {
    contextStore.run({ context: mockContext }, () => {
      expect(getContext()).toBe(mockContext)
    })
  })

  test('returns the context from a child async scope', async () => {
    const childScope = async () => {
      await Promise.resolve()
      return getContext()
    }

    const result = await contextStore.run({ context: mockContext }, childScope)

    expect(result).toBe(mockContext)
  })

  test('returns null when called outside a request scope', () => {
    expect(getContext()).toBeNull()
  })
})
