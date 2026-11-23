import { expect, test, vi } from 'vitest'

import { getSandbox } from './get_sandbox.js'
import { callOf, json, mockFetch, payload } from './test_helpers.js'

const options = { siteID: payload.site_id, token: 'token' }

const running = { id: 'p1', argv: ['npm', 'test'], started_at: '2026-09-08T12:00:00Z', exited: false }
const finished = { ...running, exited: true, exit_code: 0, ended_at: '2026-09-08T12:00:05Z' }

const output = (over = {}) => ({
  stdout: '',
  stderr: '',
  stdout_offset: 0,
  stderr_offset: 0,
  process: running,
  ...over,
})

test('starts a process and resolves before it exits', async () => {
  const fetch = mockFetch(json(payload, 201), json(running))
  const sandbox = await getSandbox('build', { ...options, fetch })
  const process = await sandbox.commands.start(['npm', 'test'])

  const call = callOf(fetch, 1)

  expect(call.url).toBe(`https://${payload.hostname}/.netlify/sandbox/processes`)
  expect(call.method).toBe('POST')
  expect(call.body.argv).toStrictEqual(['npm', 'test'])

  expect(process.id).toBe('p1')
  expect(process.exited).toBe(false)
})

test('reads output from where it last got to', async () => {
  const fetch = mockFetch(
    json(payload, 201),
    json(output({ stdout: 'one\n', stdout_offset: 4 })),
    json(output({ stdout: 'two\n', stdout_offset: 8, process: finished })),
  )
  const sandbox = await getSandbox('build', { ...options, fetch })
  const process = sandbox.commands.get('p1')

  const first = await process.read()

  expect(first.stdout).toBe('one\n')
  expect(callOf(fetch, 1).url).toContain('stdout_since=0&stderr_since=0')

  const second = await process.read()

  expect(second.stdout).toBe('two\n')
  expect(callOf(fetch, 2).url).toContain('stdout_since=4&stderr_since=0')
  expect(process.exited).toBe(true)
  expect(process.exitCode).toBe(0)
})

test('a handle from get learns what it did not know', async () => {
  const fetch = mockFetch(json(payload, 201), json(finished))
  const sandbox = await getSandbox('build', { ...options, fetch })
  const process = sandbox.commands.get('p1')

  expect(process.argv).toBeUndefined()
  expect(process.startedAt).toBeUndefined()

  await process.status()

  expect(process.argv).toStrictEqual(['npm', 'test'])
  expect(process.startedAt).toStrictEqual(new Date('2026-09-08T12:00:00Z'))
})

test('resumes from a cursor a caller carried across requests', async () => {
  const fetch = mockFetch(
    json(payload, 201),
    json(output({ stdout_offset: 9, stderr_offset: 3 })),
    json(output({ stdout_offset: 12, stderr_offset: 3 })),
  )
  const sandbox = await getSandbox('build', { ...options, fetch })

  const first = sandbox.commands.get('p1')
  await first.read()

  await sandbox.commands.get('p1', { cursor: first.cursor }).read()

  expect(callOf(fetch, 2).url).toContain('stdout_since=9&stderr_since=3')
})

test('lists what the sandbox is still tracking', async () => {
  const fetch = mockFetch(json(payload, 201), json({ processes: [running, finished] }))
  const sandbox = await getSandbox('build', { ...options, fetch })
  const processes = await sandbox.commands.list()

  expect(callOf(fetch, 1).method).toBe('GET')
  expect(processes.map((p) => p.id)).toStrictEqual(['p1', 'p1'])
  expect(processes[1].exited).toBe(true)
})

test('kills a process and reports its final state', async () => {
  const fetch = mockFetch(json(payload, 201), json({ ...finished, exit_code: 143 }))
  const sandbox = await getSandbox('build', { ...options, fetch })
  const process = sandbox.commands.get('p1')

  await process.kill()

  expect(callOf(fetch, 1).method).toBe('DELETE')
  expect(process.exited).toBe(true)
  expect(process.exitCode).toBe(143)
})

test('output yields chunks until the process exits, then reads once more', async () => {
  const fetch = mockFetch(
    json(payload, 201),
    json(output({ stdout: 'a', stdout_offset: 1 })),
    json(output({ stdout: 'b', stdout_offset: 2, process: finished })),
    json(output({ stdout: 'c', stdout_offset: 3, process: finished })),
  )
  const sandbox = await getSandbox('build', { ...options, fetch })
  const chunks: string[] = []

  for await (const chunk of sandbox.commands.get('p1').output({ intervalMs: 0 })) {
    chunks.push(chunk.stdout)
  }

  // The read that observes the exit is not the last one: anything written
  // between that read and the exit would be lost without one more.
  expect(chunks).toStrictEqual(['a', 'b', 'c'])
})

test('output stops when the signal aborts', async () => {
  const fetch = mockFetch(json(payload, 201), json(output({ stdout: 'a', stdout_offset: 1 })))
  const sandbox = await getSandbox('build', { ...options, fetch })
  const controller = new AbortController()

  const reading = (async () => {
    for await (const _ of sandbox.commands.get('p1').output({ intervalMs: 50, signal: controller.signal })) {
      controller.abort(new Error('enough'))
    }
  })()

  await expect(reading).rejects.toThrow('enough')
})

test('wait resolves with the exit code and the output since the cursor', async () => {
  const failed = { ...finished, exit_code: 2 }
  const fetch = mockFetch(
    json(payload, 201),
    json(output({ stdout: 'a', stdout_offset: 1 })),
    json(output({ stdout: 'b', stderr: 'oops', stdout_offset: 2, stderr_offset: 4, process: failed })),
    json(output({ stdout_offset: 2, stderr_offset: 4, process: failed })),
  )
  const sandbox = await getSandbox('build', { ...options, fetch })

  const result = await sandbox.commands.get('p1').wait({ intervalMs: 0 })

  expect(result).toStrictEqual({ exitCode: 2, stdout: 'ab', stderr: 'oops', truncated: false })
})

test('run is unchanged by any of this', async () => {
  const fetch = mockFetch(json(payload, 201), json({ exit_code: 0, stdout: 'hi' }))
  const sandbox = await getSandbox('build', { ...options, fetch })
  const result = await sandbox.commands.run('echo hi')

  expect(callOf(fetch, 1).url).toBe(`https://${payload.hostname}/.netlify/sandbox/commands`)
  expect(result.stdout).toBe('hi')
})

test('wait reports truncation from a chunk that carries no output', async () => {
  const fetch = mockFetch(
    json(payload, 201),
    json(output({ truncated: true, process: finished })),
    json(output({ process: finished })),
  )
  const sandbox = await getSandbox('build', { ...options, fetch })
  const result = await sandbox.commands.get('p1').wait({ intervalMs: 0 })

  expect(result.truncated).toBe(true)
})

test('keeps the exit code when a later response leaves it out', async () => {
  const { exit_code: _, ...withoutExitCode } = { ...finished, exit_code: 3 }
  const fetch = mockFetch(
    json(payload, 201),
    json({ ...finished, exit_code: 3 }),
    json(output({ process: withoutExitCode })),
    json(output({ process: withoutExitCode })),
  )
  const sandbox = await getSandbox('build', { ...options, fetch })
  const process = sandbox.commands.get('p1')

  await process.status()

  const result = await process.wait({ intervalMs: 0 })

  expect(result.exitCode).toBe(3)
})

test('encodes the process ID in the path', async () => {
  const fetch = mockFetch(json(payload, 201), json(finished))
  const sandbox = await getSandbox('build', { ...options, fetch })

  await sandbox.commands.get('../commands?x').status()

  expect(callOf(fetch, 1).url).toBe(`https://${payload.hostname}/.netlify/sandbox/processes/..%2Fcommands%3Fx`)
})

test('polling leaves no abort listeners behind', async () => {
  const fetch = mockFetch(
    json(payload, 201),
    json(output({ stdout: 'a', stdout_offset: 1 })),
    json(output({ stdout: 'b', stdout_offset: 2 })),
    json(output({ process: finished })),
    json(output({ process: finished })),
  )
  const sandbox = await getSandbox('build', { ...options, fetch })
  const controller = new AbortController()
  const added = vi.spyOn(controller.signal, 'addEventListener')
  const removed = vi.spyOn(controller.signal, 'removeEventListener')

  await sandbox.commands.get('p1').wait({ intervalMs: 0, signal: controller.signal })

  expect(added).toHaveBeenCalled()
  expect(removed).toHaveBeenCalledTimes(added.mock.calls.length)
})
