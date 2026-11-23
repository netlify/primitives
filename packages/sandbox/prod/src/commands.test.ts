import { expect, test } from 'vitest'

import { CommandError } from './error.js'
import { callOf, client, json, mockFetch, payload } from './test_helpers.js'

test('runs a command against the sandbox hostname, carrying the token', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 0, stdout: 'hello\n', stderr: '' }))

  const sandbox = await client(fetch).create()
  const result = await sandbox.commands.run(['echo', 'hello'])
  const call = callOf(fetch, 1)

  expect(call.url).toBe(`https://${payload.hostname}/.netlify/sandbox/commands`)
  expect(call.body.argv).toStrictEqual(['echo', 'hello'])
  expect(call.headers.authorization).toBe('Bearer token')

  expect(result).toStrictEqual({ exitCode: 0, stdout: 'hello\n', stderr: '', truncated: false })
})

test('runs a string command through a shell', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 0, stdout: '', stderr: '' }))

  const sandbox = await client(fetch).create()
  await sandbox.commands.run('ls -la | wc -l')

  expect(callOf(fetch, 1).body.argv).toStrictEqual(['sh', '-c', 'ls -la | wc -l'])
})

test('reports a non-zero exit rather than throwing', async () => {
  const fetch = mockFetch(
    json(payload, 201),
    json({ exit_code: 2, stdout: '', stderr: 'no such file', truncated: true }),
  )

  const sandbox = await client(fetch).create()
  const result = await sandbox.commands.run(['cat', '/nope'])

  expect(result.exitCode).toBe(2)
  expect(result.stderr).toBe('no such file')
  expect(result.truncated).toBe(true)
})

test('sends cwd and env with the command', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 0 }))

  const sandbox = await client(fetch).create()
  await sandbox.commands.run('npm test', { cwd: '/app', env: { CI: '1' } })

  expect(callOf(fetch, 1).body).toStrictEqual({ argv: ['sh', '-c', 'npm test'], dir: '/app', env: { CI: '1' } })
})

test('$ quotes what is interpolated, so the shell parses none of it', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 0, stdout: 'done\n' }))

  const sandbox = await client(fetch).create()
  const dir = "my dir; rm -rf / 'x'"
  const result = await sandbox.$`git clone ${'https://example.com/repo.git'} ${dir} --depth ${1}`

  expect(callOf(fetch, 1).body.argv).toStrictEqual([
    'sh',
    '-c',
    String.raw`git clone 'https://example.com/repo.git' 'my dir; rm -rf / '\''x'\''' --depth '1'`,
  ])
  expect(result.stdout).toBe('done\n')
})

test('$ turns an array into one argument per item', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 0 }))

  const sandbox = await client(fetch).create()
  await sandbox.$`npm install ${['left pad', 'react']}`

  expect(callOf(fetch, 1).body.argv).toStrictEqual(['sh', '-c', `npm install 'left pad' 'react'`])
})

test('$ rejects with the output when the command exits with a non-zero code', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 2, stdout: 'partial', stderr: 'no such file\n' }))

  const sandbox = await client(fetch).create()
  const error = await sandbox.$`cat /nope`.catch((err: unknown) => err)

  expect(error).toBeInstanceOf(CommandError)
  expect((error as CommandError).code).toBe('command_failed')
  expect((error as CommandError).exitCode).toBe(2)
  expect((error as CommandError).stdout).toBe('partial')
  expect((error as CommandError).message).toBe('`cat /nope` exited with code 2: no such file')
})

test('$ works when taken off the sandbox', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 0 }))

  const { $ } = await client(fetch).create()
  await $`npm test`

  expect(callOf(fetch, 1).body).toStrictEqual({ argv: ['sh', '-c', 'npm test'] })
})
