import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { afterEach, beforeEach, expect, test } from 'vitest'

// macOS resolves the default keychain via $HOME, so the helpers run in a child process whose HOME
// holds a throwaway keychain; this can't be done in-process. Other platforms can't be redirected,
// so they use a uniquely named entry that is always deleted.
const usesIsolatedKeychain = process.platform === 'darwin'
const KEYCHAIN_MODULE = new URL('./keychain.ts', import.meta.url).href
const execFileAsync = promisify(execFile)

let home: string
let account: string

beforeEach(async () => {
  home = await mkdtemp(path.join(tmpdir(), 'dev-utils-keychain-'))
  account = `dev-utils-test-${Date.now().toString()}-${Math.random().toString(36).slice(2)}`
  if (usesIsolatedKeychain) {
    await mkdir(path.join(home, 'Library', 'Keychains'), { recursive: true })
    // HOME is overridden for `security` too, or it would add the keychain to the real search list
    await execFileAsync(
      'security',
      ['create-keychain', '-p', '', path.join(home, 'Library', 'Keychains', 'login.keychain-db')],
      {
        env: { ...process.env, HOME: home },
      },
    )
  }
})

afterEach(async () => {
  await runHelpers(`await k.deleteTokenFromKeychain(${JSON.stringify(account)})`)
  await rm(home, { recursive: true, force: true })
})

const runHelpers = async (body: string): Promise<unknown> => {
  const script = `const k = await import(${JSON.stringify(KEYCHAIN_MODULE)}); const result = await (async () => { ${body} })(); process.stdout.write(JSON.stringify(result ?? null))`
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings', '--input-type=module', '-e', script],
    {
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      env: usesIsolatedKeychain ? { ...process.env, HOME: home } : process.env,
    },
  )
  return JSON.parse(stdout) as unknown
}

test('round-trips a token through the real OS keychain', async (context) => {
  const a = JSON.stringify(account)
  const result = await runHelpers(`
    const stored = (await k.storeTokenInKeychain(${a}, 'first')).status
    await k.storeTokenInKeychain(${a}, 'second')
    const read = await k.getTokenFromKeychain(${a})
    const deleted = (await k.deleteTokenFromKeychain(${a})).status
    const afterDelete = await k.getTokenFromKeychain(${a})
    return { stored, read, deleted, afterDelete }
  `)

  // Whether Linux has a usable keychain is only known at runtime, so `skipIf` can't express this
  // eslint-disable-next-line vitest/no-disabled-tests
  if (process.platform === 'linux' && (result as { stored: string }).stored === 'error') context.skip()

  expect(result).toEqual({ stored: 'stored', read: 'second', deleted: 'deleted', afterDelete: null })
})
