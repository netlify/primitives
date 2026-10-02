import { Fixture } from '@netlify/test-utils'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { createRewriter } from './rewriter.js'

const { createMatcher } = vi.hoisted(() => ({
  createMatcher: vi.fn(() => Promise.resolve({ match: () => null, parseErrors: [], rulesCount: 0, close: () => {} })),
}))

vi.mock('@netlify/redirect-matcher', () => ({ createMatcher }))

describe('createRewriter', () => {
  const fixtures: Fixture[] = []

  const rewriterFor = async (configRedirects: { from: string; to: string }[]) => {
    const fixture = new Fixture()
    fixtures.push(fixture)
    const projectDir = await fixture.create()

    return createRewriter({ configRedirects, jwtRoleClaim: '', jwtSecret: '', projectDir })
  }

  afterEach(async () => {
    createMatcher.mockClear()
    await Promise.all(fixtures.splice(0).map((fixture) => fixture.destroy()))
  })

  // Loading the matcher compiles a 4 MB WebAssembly module, which a site
  // without redirects should not pay for.
  test('does not load the matcher when there are no rules', async () => {
    const rewriter = await rewriterFor([])

    expect(await rewriter(new Request('https://site.netlify/any'))).toBeNull()
    expect(createMatcher).not.toHaveBeenCalled()
  })

  test('loads the matcher once when there are rules', async () => {
    const rewriter = await rewriterFor([{ from: '/from', to: '/to' }])

    await rewriter(new Request('https://site.netlify/from'))
    await rewriter(new Request('https://site.netlify/other'))
    expect(createMatcher).toHaveBeenCalledTimes(1)
  })
})
