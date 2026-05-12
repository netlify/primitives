import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { FileWatcher } from './index.js'

// Helper to wait for file system events to propagate through chokidar.
// macOS FSEvents can be slow, so we use a generous delay.
const waitForEvents = (ms = 500) => new Promise<void>((resolve) => setTimeout(resolve, ms))

describe('FileWatcher', () => {
  let tempDir: string
  let watcher: FileWatcher

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'file-watcher-test-'))
    watcher = new FileWatcher()
  })

  afterEach(async () => {
    await watcher.close()
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  test('routes change events to the correct subscription', async () => {
    const dirA = path.join(tempDir, 'a')
    const dirB = path.join(tempDir, 'b')
    await fs.mkdir(dirA)
    await fs.mkdir(dirB)

    const fileA = path.join(dirA, 'test.txt')
    const fileB = path.join(dirB, 'test.txt')
    await fs.writeFile(fileA, 'initial')
    await fs.writeFile(fileB, 'initial')

    const changesA = vi.fn()
    const changesB = vi.fn()

    watcher.subscribe({ paths: dirA, onChange: changesA })
    watcher.subscribe({ paths: dirB, onChange: changesB })

    await waitForEvents()
    changesA.mockClear()
    changesB.mockClear()

    await fs.writeFile(fileA, 'changed')
    await waitForEvents()

    expect(changesA).toHaveBeenCalled()
    const allPathsA = changesA.mock.calls.flatMap((call: [string[]]) => call[0])
    expect(allPathsA).toContain(fileA)
    expect(changesB).not.toHaveBeenCalled()
  })

  test('routes add events correctly', async () => {
    const dir = path.join(tempDir, 'add-test')
    await fs.mkdir(dir)

    const onAdd = vi.fn()

    watcher.subscribe({ paths: dir, onAdd })

    await waitForEvents()
    onAdd.mockClear()

    const newFile = path.join(dir, 'new.txt')
    await fs.writeFile(newFile, 'hello')
    await waitForEvents()

    expect(onAdd).toHaveBeenCalled()
    const allPaths = onAdd.mock.calls.flatMap((call: [string[]]) => call[0])
    expect(allPaths).toContain(newFile)
  })

  test('routes unlink events correctly', async () => {
    const dir = path.join(tempDir, 'unlink-test')
    await fs.mkdir(dir)
    const file = path.join(dir, 'doomed.txt')
    await fs.writeFile(file, 'goodbye')

    const onUnlink = vi.fn()

    watcher.subscribe({ paths: dir, onUnlink })

    await waitForEvents()
    onUnlink.mockClear()

    await fs.unlink(file)
    await waitForEvents()

    expect(onUnlink).toHaveBeenCalled()
    const allPaths = onUnlink.mock.calls.flatMap((call: [string[]]) => call[0])
    expect(allPaths).toContain(file)
  })

  test('supports dynamic path addition via handle.add()', async () => {
    const dir1 = path.join(tempDir, 'dir1')
    const dir2 = path.join(tempDir, 'dir2')
    await fs.mkdir(dir1)
    await fs.mkdir(dir2)
    await fs.writeFile(path.join(dir2, 'existing.txt'), 'initial')

    const onChange = vi.fn()

    const handle = watcher.subscribe({ paths: dir1, onChange })

    await waitForEvents()
    onChange.mockClear()

    // Changes in dir2 should not trigger yet
    await fs.writeFile(path.join(dir2, 'existing.txt'), 'changed-before')
    await waitForEvents()
    expect(onChange).not.toHaveBeenCalled()

    // Add dir2 dynamically
    handle.add(dir2)
    await waitForEvents()
    onChange.mockClear()

    // Now changes in dir2 should trigger
    await fs.writeFile(path.join(dir2, 'existing.txt'), 'changed-after')
    await waitForEvents()
    expect(onChange).toHaveBeenCalled()
  })

  test('supports dynamic path removal via handle.unwatch()', async () => {
    const dir = path.join(tempDir, 'unwatch-test')
    await fs.mkdir(dir)
    const file = path.join(dir, 'test.txt')
    await fs.writeFile(file, 'initial')

    const onChange = vi.fn()

    const handle = watcher.subscribe({ paths: dir, onChange })

    await waitForEvents()

    await fs.writeFile(file, 'change1')
    await waitForEvents()
    expect(onChange).toHaveBeenCalled()

    // Unwatch the directory
    handle.unwatch(dir)
    onChange.mockClear()
    await waitForEvents()

    // Changes should no longer trigger
    await fs.writeFile(file, 'change2')
    await waitForEvents()
    expect(onChange).not.toHaveBeenCalled()
  })

  test('enforces depth constraint', async () => {
    const dir = path.join(tempDir, 'depth-test')
    const subDir = path.join(dir, 'sub')
    await fs.mkdir(subDir, { recursive: true })

    // Pre-create the file at depth 1 so we can test onChange
    const shallowFile = path.join(dir, 'direct.txt')
    await fs.writeFile(shallowFile, 'initial')
    await fs.writeFile(path.join(subDir, 'shallow.txt'), 'initial')

    const onChange = vi.fn()

    // depth: 1 means only files directly in `dir` (relative path has 1 segment)
    watcher.subscribe({ paths: dir, onChange, depth: 1 })

    await waitForEvents()
    onChange.mockClear()

    // Modify a file at depth 1 (directly in dir) — should trigger
    await fs.writeFile(shallowFile, 'changed')
    await waitForEvents()
    expect(onChange).toHaveBeenCalled()
    const allPaths = onChange.mock.calls.flatMap((call: [string[]]) => call[0])
    expect(allPaths).toContain(shallowFile)

    onChange.mockClear()

    // Modify a file at depth 2 (in subdir) — should be filtered out
    await fs.writeFile(path.join(subDir, 'shallow.txt'), 'changed')
    await waitForEvents()
    expect(onChange).not.toHaveBeenCalled()
  })

  test('unsubscribe() stops events for that subscription', async () => {
    const dir = path.join(tempDir, 'unsub-test')
    await fs.mkdir(dir)
    const file = path.join(dir, 'test.txt')
    await fs.writeFile(file, 'initial')

    const onChange = vi.fn()

    const handle = watcher.subscribe({ paths: dir, onChange })

    await waitForEvents()

    await fs.writeFile(file, 'change1')
    await waitForEvents()
    expect(onChange).toHaveBeenCalled()

    handle.unsubscribe()
    onChange.mockClear()

    await fs.writeFile(file, 'change2')
    await waitForEvents()
    expect(onChange).not.toHaveBeenCalled()
  })

  test('close() shuts down the watcher', async () => {
    const dir = path.join(tempDir, 'close-test')
    await fs.mkdir(dir)
    const file = path.join(dir, 'test.txt')
    await fs.writeFile(file, 'initial')

    const onChange = vi.fn()

    watcher.subscribe({ paths: dir, onChange })

    await waitForEvents()
    onChange.mockClear()

    await watcher.close()

    await fs.writeFile(file, 'changed')
    await waitForEvents()
    expect(onChange).not.toHaveBeenCalled()
  })

  test('shared paths only unwatched when no subscription needs them', async () => {
    const dir = path.join(tempDir, 'shared-test')
    await fs.mkdir(dir)
    const file = path.join(dir, 'test.txt')
    await fs.writeFile(file, 'initial')

    const onChange1 = vi.fn()
    const onChange2 = vi.fn()

    const handle1 = watcher.subscribe({ paths: dir, onChange: onChange1 })
    watcher.subscribe({ paths: dir, onChange: onChange2 })

    await waitForEvents()
    onChange1.mockClear()
    onChange2.mockClear()

    // Unsubscribe the first — the second should still get events
    handle1.unsubscribe()

    await fs.writeFile(file, 'changed')
    await waitForEvents()

    expect(onChange1).not.toHaveBeenCalled()
    expect(onChange2).toHaveBeenCalled()
  })

  test('subscribe with same id and same paths is a no-op', async () => {
    const dir = path.join(tempDir, 'id-noop-test')
    await fs.mkdir(dir)
    const file = path.join(dir, 'test.txt')
    await fs.writeFile(file, 'initial')

    const onChange = vi.fn()

    const handle1 = watcher.subscribe({ id: 'my-watcher', paths: dir, onChange })

    await waitForEvents()
    onChange.mockClear()

    // Subscribe again with the same id and same paths
    const handle2 = watcher.subscribe({ id: 'my-watcher', paths: dir, onChange })

    // Should return the exact same handle
    expect(handle2).toBe(handle1)

    // Events should still work
    await fs.writeFile(file, 'changed')
    await waitForEvents()
    expect(onChange).toHaveBeenCalled()
  })

  test('subscribe with same id but different paths swaps the watched directory', async () => {
    const dir1 = path.join(tempDir, 'id-swap-dir1')
    const dir2 = path.join(tempDir, 'id-swap-dir2')
    await fs.mkdir(dir1)
    await fs.mkdir(dir2)
    const file1 = path.join(dir1, 'test.txt')
    const file2 = path.join(dir2, 'test.txt')
    await fs.writeFile(file1, 'initial')
    await fs.writeFile(file2, 'initial')

    const onChange = vi.fn()

    watcher.subscribe({ id: 'config-path', paths: dir1, onChange })

    await waitForEvents()
    onChange.mockClear()

    // Verify dir1 is being watched
    await fs.writeFile(file1, 'changed')
    await waitForEvents()
    expect(onChange).toHaveBeenCalled()
    onChange.mockClear()

    // Now subscribe with the same id but a different path
    watcher.subscribe({ id: 'config-path', paths: dir2, onChange })

    await waitForEvents()
    onChange.mockClear()

    // dir1 should no longer trigger events
    await fs.writeFile(file1, 'changed again')
    await waitForEvents()
    expect(onChange).not.toHaveBeenCalled()

    // dir2 should trigger events
    await fs.writeFile(file2, 'changed')
    await waitForEvents()
    expect(onChange).toHaveBeenCalled()
  })

  test('named and unnamed subscriptions do not interfere', async () => {
    const dir = path.join(tempDir, 'named-unnamed-test')
    await fs.mkdir(dir)
    const file = path.join(dir, 'test.txt')
    await fs.writeFile(file, 'initial')

    const onChangeNamed = vi.fn()
    const onChangeUnnamed = vi.fn()

    watcher.subscribe({ id: 'named', paths: dir, onChange: onChangeNamed })
    watcher.subscribe({ paths: dir, onChange: onChangeUnnamed })

    await waitForEvents()
    onChangeNamed.mockClear()
    onChangeUnnamed.mockClear()

    await fs.writeFile(file, 'changed')
    await waitForEvents()

    expect(onChangeNamed).toHaveBeenCalled()
    expect(onChangeUnnamed).toHaveBeenCalled()
  })

  test('multiple event types work independently', async () => {
    const dir = path.join(tempDir, 'multi-event-test')
    await fs.mkdir(dir)

    const onAdd = vi.fn()
    const onChange = vi.fn()
    const onUnlink = vi.fn()

    watcher.subscribe({ paths: dir, onAdd, onChange, onUnlink })

    await waitForEvents()
    onAdd.mockClear()
    onChange.mockClear()
    onUnlink.mockClear()

    const file = path.join(dir, 'lifecycle.txt')
    await fs.writeFile(file, 'created')
    await waitForEvents()
    expect(onAdd).toHaveBeenCalled()

    await fs.writeFile(file, 'modified')
    await waitForEvents()
    expect(onChange).toHaveBeenCalled()

    await fs.unlink(file)
    await waitForEvents()
    expect(onUnlink).toHaveBeenCalled()
  })
})
