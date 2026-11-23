import { expect, test } from 'vitest'

import { SandboxError } from './error.js'
import { callOf, client, json, mockFetch, payload } from './test_helpers.js'

test('writes a file as base64 in an argument, since commands carry no stdin', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 0, stdout: '', stderr: '' }))

  const sandbox = await client(fetch).create()
  await sandbox.files.write('/work/notes.txt', 'a line\nand "quotes" $HOME\n')

  const argv = callOf(fetch, 1).body.argv as string[]

  // The contents and the path are arguments, so the shell parses neither.
  expect(argv.slice(0, 2)).toStrictEqual(['sh', '-c'])
  expect(argv.at(-1)).toBe('/work/notes.txt')
  expect(atob(argv.at(-2) ?? '')).toBe('a line\nand "quotes" $HOME\n')
})

test('turns a failed write into an error naming the path', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 1, stdout: '', stderr: 'Read-only file system\n' }))

  const sandbox = await client(fetch).create()

  await expect(sandbox.files.write('/etc/passwd', 'x')).rejects.toThrow(
    'could not write /etc/passwd: Read-only file system',
  )
})

test('lists a directory, dropping the blank line ls leaves', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 0, stdout: 'bin\netc\nwork\n', stderr: '' }))

  const sandbox = await client(fetch).create()

  await expect(sandbox.files.list('/')).resolves.toStrictEqual(['bin', 'etc', 'work'])
})

test('refuses to return part of a file the sandbox cut short', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 0, stdout: 'half', truncated: true }))

  const sandbox = await client(fetch).create()
  const error = await sandbox.files.read('/work/big.log').catch((err: unknown) => err)

  expect(error).toBeInstanceOf(SandboxError)
  expect((error as SandboxError).code).toBe('output_truncated')
})

// A path that starts with a hyphen has to stay a path, not become an option.
test('keeps a path that starts with a hyphen from being read as an option', async () => {
  const fetch = mockFetch(
    json(payload, 201),
    json({ exit_code: 0, stdout: 'x' }),
    json({ exit_code: 0, stdout: 'a\n' }),
    json({ exit_code: 0 }),
  )
  const sandbox = await client(fetch).create()

  await sandbox.files.read('-n')
  await sandbox.files.list('-l')
  await sandbox.files.write('-f', 'x')

  expect(callOf(fetch, 1).body.argv).toStrictEqual(['cat', '--', '-n'])
  expect(callOf(fetch, 2).body.argv).toStrictEqual(['ls', '-1A', '--', '-l'])
  expect((callOf(fetch, 3).body.argv as string[])[2]).toContain('dirname -- "$2"')
})
