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

describe.runIf(isSupportedNode && !isWindows)('build output when deployed to Netlify', () => {
  let fixture: Fixture
  let baseUrl: string
  beforeAll(async () => {
    fixture = new Fixture().fromDirectory(path.join(FIXTURES_DIR, 'start-basic-alpha'))
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
    await page.waitForSelector('text=Hello deferred!')
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
    await page.click('text=sunt aut facere repe')
    await page.waitForSelector('text=quia et suscipit suscipit')
  })
})
