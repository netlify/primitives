import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Fixture } from '@netlify/dev-utils'
import { type Browser, type Page, chromium } from 'playwright'
import semver from 'semver'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest'

import { deploySite } from '../support/netlify-deploy.js'

const FIXTURES_DIR = fileURLToPath(new URL('../fixtures', import.meta.url))

const isSupportedNode = semver.gte(process.versions.node, '22.12.0')
// TODO(serhalp) e2e fixture deploy fails on Windows - investigate and re-enable
const isWindows = process.platform === 'win32'
// Live tests require secrets (e.g. NETLIFY_AUTH_TOKEN) which are unavailable in fork PRs.
// CI sets SKIP_LIVE_TESTS=true in that case. See .github/workflows/test.yaml.
const skipLiveTests = process.env.SKIP_LIVE_TESTS === 'true'

describe.runIf(isSupportedNode && !isWindows && !skipLiveTests)('build output when deployed to Netlify', () => {
  let fixture: Fixture
  let baseUrl: string
  beforeAll(async () => {
    fixture = new Fixture().fromDirectory(path.join(FIXTURES_DIR, 'start-basic-rc'))
    const fixtureRoot = await fixture.create()
    const { url } = await deploySite(fixtureRoot)
    baseUrl = url
  })
  afterAll(async () => fixture.destroy())

  let browser: Browser
  let page: Page
  beforeEach(async () => {
    browser = await chromium.launch()
    page = await browser.newPage()
  })
  afterEach(async () => {
    await browser.close()
  })

  test('Renders SSR pages', async () => {
    const response = await page.goto(baseUrl)
    expect(response?.status()).toBe(200)
    expect(await response?.text()).toContain('Welcome Home!!!')
  })

  test('Renders custom 404 SSR page', async () => {
    const response = await page.goto(`${baseUrl}/this-route-does-not-exist`)
    expect(response?.status()).toBe(404)
    expect(await response?.text()).toContain('The page you are looking for does not exist.')
  })

  test('Renders streamed React Suspense components', async () => {
    const response = await page.goto(`${baseUrl}/deferred`)
    expect(response?.status()).toBe(200)
    // This is eventually rendered on the client once it's ready
    await page.getByText('Hello deferred!').waitFor()
  })

  test('Handles Server Routes', async () => {
    const response = await page.goto(`${baseUrl}/api/users`)
    expect(response?.status()).toBe(200)
    const body = (await response?.text()) ?? ''
    expect(body).toContain('Ervin Howell')
    expect(() => {
      JSON.parse(body)
    }, 'Expected API endpoint to return JSON').not.toThrow()
  })

  test('Handles Server Functions', async () => {
    const response = await page.goto(`${baseUrl}/posts`)
    expect(response?.status()).toBe(200)
    // A Server Function is used on client-side navigation to a post page
    await page.getByText('sunt aut facere repe').click()
    await page.getByText('quia et suscipit suscipit').waitFor()
  })

  test('Renders basic RSC page with server components', async () => {
    const response = await page.goto(`${baseUrl}/rsc-basic`)
    expect(response?.status()).toBe(200)
    // The greeting is rendered by a server component via renderServerComponent
    await page.getByTestId('rsc-greeting').filter({ hasText: 'Hello from a Server Component!' }).waitFor()
    // The user list is also rendered as a server component with data fetching
    await page.getByTestId('rsc-user-list').filter({ hasText: 'Ervin Howell' }).waitFor()
  })

  test('Renders composite RSC page with client component children', async () => {
    const response = await page.goto(`${baseUrl}/rsc-composite`)
    expect(response?.status()).toBe(200)
    // The card shell is rendered on the server via createCompositeComponent
    await page.getByTestId('rsc-card').filter({ hasText: 'Server-Rendered Card' }).waitFor()
    // The counter is a client component passed as a children slot.
    // Wait for hydration before clicking — the button is in the SSR markup
    // but its event listener isn't attached until React hydrates on the client.
    await page.getByTestId('client-counter').and(page.locator('[data-hydrated="true"]')).waitFor()
    const counterValue = page.getByTestId('counter-value')
    expect(await counterValue.textContent()).toBe('0')
    // Verify client interactivity works within the server-rendered shell
    await page.getByTestId('counter-button').click()
    await counterValue.filter({ hasText: /^1$/ }).waitFor()
  })
})
