import { mkdir, mkdtemp, readFile, readlink, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { buffer } from 'node:stream/consumers'

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ZipFile } from 'yazl'

import { Reactive } from '@netlify/dev-utils'
import { SYNCHRONOUS_FUNCTION_TIMEOUT, BACKGROUND_FUNCTION_TIMEOUT } from '@netlify/functions'
import { FunctionsRegistry } from './registry.js'

interface ZipEntry {
  contents?: Buffer | string
  mode?: number
  name: string
}

const createZipArchive = async (entries: ZipEntry[]) => {
  const archive = new ZipFile()

  for (const { contents = '', mode, name } of entries) {
    const contentsBuffer = Buffer.isBuffer(contents) ? contents : Buffer.from(contents)

    if (name.endsWith('/')) {
      archive.addEmptyDirectory(name, { mode })
    } else {
      archive.addBuffer(contentsBuffer, name, { compress: false, mode })
    }
  }

  const output = buffer(archive.outputStream)
  archive.end()

  return await output
}

// yazl rejects unsafe names, so mutate both equal-length filename records for this security fixture.
const replaceEntryName = (archive: Buffer, currentName: string, replacementName: string) => {
  const currentNameBuffer = Buffer.from(currentName)
  const replacementNameBuffer = Buffer.from(replacementName)

  if (currentNameBuffer.length !== replacementNameBuffer.length) {
    throw new Error('ZIP entry name replacements must have equal lengths')
  }

  const result = Buffer.from(archive)
  let offset = 0
  let replacements = 0

  while ((offset = result.indexOf(currentNameBuffer, offset)) !== -1) {
    replacementNameBuffer.copy(result, offset)
    offset += replacementNameBuffer.length
    replacements += 1
  }

  if (replacements !== 2) {
    throw new Error(`Expected to replace two ZIP entry names, replaced ${String(replacements)}`)
  }

  return result
}

describe('FunctionsRegistry ZIP extraction', () => {
  let projectRoot: string

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'functions-registry-'))
  })

  afterEach(async () => {
    await rm(projectRoot, { force: true, recursive: true })
  })

  const extractArchiveBuffer = async (archive: Buffer, name = 'test-function') => {
    const archivePath = join(projectRoot, `${name}.zip`)
    const registry = new FunctionsRegistry({
      config: new Reactive({}),
      destPath: 'functions-serve',
      projectRoot,
      settings: {},
    })

    await writeFile(archivePath, archive)

    return await registry.unzipFunction({ mainFile: archivePath, name } as Parameters<
      FunctionsRegistry['unzipFunction']
    >[0])
  }

  const extractArchive = async (entries: ZipEntry[], name = 'test-function') =>
    await extractArchiveBuffer(await createZipArchive(entries), name)

  test('extracts files and directories while ignoring macOS metadata', async () => {
    const targetDirectory = await extractArchive([
      { contents: 'export default "hello"', mode: 0o100644, name: 'nested/function.mjs' },
      { mode: 0o040755, name: 'empty/' },
      { contents: 'ignored', mode: 0o100644, name: '__MACOSX/metadata' },
    ])

    expect(await readFile(join(targetDirectory, 'nested/function.mjs'), 'utf8')).toBe('export default "hello"')
    expect((await stat(join(targetDirectory, 'empty'))).isDirectory()).toBe(true)
    await expect(stat(join(targetDirectory, '__MACOSX'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test.skipIf(process.platform === 'win32')('preserves Unix file modes and symbolic links', async () => {
    const targetDirectory = await extractArchive([
      { contents: 'target', mode: 0o100755, name: 'nested/target' },
      { contents: 'nested/target', mode: 0o120777, name: 'link' },
    ])

    expect((await stat(join(targetDirectory, 'nested/target'))).mode & 0o777).toBe(0o755)
    expect(await readlink(join(targetDirectory, 'link'))).toBe('nested/target')
    expect(await readFile(join(targetDirectory, 'link'), 'utf8')).toBe('target')
  })

  test.skipIf(process.platform === 'win32')('preserves a leading UTF-8 BOM in symbolic link targets', async () => {
    const targetName = '\uFEFFtarget'
    const targetDirectory = await extractArchive([
      { contents: 'target', mode: 0o100644, name: targetName },
      { contents: targetName, mode: 0o120777, name: 'link' },
    ])

    expect(await readlink(join(targetDirectory, 'link'))).toBe(targetName)
    expect(await readFile(join(targetDirectory, 'link'), 'utf8')).toBe('target')
  })

  test.skipIf(process.platform === 'win32')('uses default modes when archive entries omit them', async () => {
    const targetDirectory = await extractArchive([
      { contents: 'file', mode: 0, name: 'file' },
      { mode: 0, name: 'directory/' },
    ])
    const expectedFile = join(projectRoot, 'expected-file')
    const expectedDirectory = join(projectRoot, 'expected-directory')

    await writeFile(expectedFile, '', { mode: 0o644 })
    await mkdir(expectedDirectory, { mode: 0o755 })

    expect((await stat(join(targetDirectory, 'file'))).mode & 0o777).toBe((await stat(expectedFile)).mode & 0o777)
    expect((await stat(join(targetDirectory, 'directory'))).mode & 0o777).toBe(
      (await stat(expectedDirectory)).mode & 0o777,
    )
  })

  test('rejects entries that leave the extraction directory', async () => {
    const targetDirectory = join(projectRoot, 'functions-serve', '.unzipped', 'test-function')
    const escapedPath = join(dirname(targetDirectory), 'escaped.txt')
    const archive = await createZipArchive([{ contents: 'escaped', mode: 0o100644, name: 'xx/escaped.txt' }])
    const unsafeArchive = replaceEntryName(archive, 'xx/escaped.txt', '../escaped.txt')

    await expect(extractArchiveBuffer(unsafeArchive)).rejects.toThrow()
    await expect(stat(escapedPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test.skipIf(process.platform === 'win32')('rejects writes through a symlinked directory', async () => {
    const targetDirectory = join(projectRoot, 'functions-serve', '.unzipped', 'test-function')
    const outsideDirectory = join(projectRoot, 'outside')

    await mkdir(targetDirectory, { recursive: true })
    await mkdir(outsideDirectory)
    await symlink(outsideDirectory, join(targetDirectory, 'linked-directory'))

    await expect(
      extractArchive([{ contents: 'escaped', mode: 0o100644, name: 'linked-directory/escaped.txt' }]),
    ).rejects.toThrow()
    await expect(stat(join(outsideDirectory, 'escaped.txt'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  test('rejects malformed archives', async () => {
    const archivePath = join(projectRoot, 'malformed.zip')
    const registry = new FunctionsRegistry({
      config: new Reactive({}),
      destPath: 'functions-serve',
      projectRoot,
      settings: {},
    })

    await writeFile(archivePath, 'not a ZIP archive')

    await expect(
      registry.unzipFunction({ mainFile: archivePath, name: 'test-function' } as Parameters<
        FunctionsRegistry['unzipFunction']
      >[0]),
    ).rejects.toThrow()
  })

  test('rejects when closing the archive fails', async () => {
    const fs = createRequire(import.meta.url)('node:fs') as typeof import('node:fs')
    const closeError = new Error('Failed to close archive')
    const close = vi.spyOn(fs, 'close').mockImplementation((_fileDescriptor, callback) => {
      setImmediate(() => {
        callback(closeError)
      })
    })
    const uncaughtErrors: unknown[] = []
    const onUncaughtError = (error: unknown) => uncaughtErrors.push(error)
    process.prependOnceListener('uncaughtException', onUncaughtError)

    try {
      const extractionError = await extractArchive([]).then(
        () => undefined,
        (error: unknown) => error,
      )

      await new Promise<void>((resolve) => setImmediate(resolve))

      expect(extractionError).toBe(closeError)
      expect(uncaughtErrors).toEqual([])
    } finally {
      process.removeListener('uncaughtException', onUncaughtError)
      close.mockRestore()
    }
  })
})

describe('FunctionsRegistry timeout configuration', () => {
  test('uses default timeouts when no config or override provided', () => {
    const registry = new FunctionsRegistry({
      config: new Reactive({}),
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: SYNCHRONOUS_FUNCTION_TIMEOUT,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('uses functions_timeout from siteInfo for sync functions only', () => {
    const registry = new FunctionsRegistry({
      config: new Reactive({
        siteInfo: {
          functions_timeout: 60,
        },
      }),
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: 60,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('uses functions_config.timeout from siteInfo for sync functions only', () => {
    const registry = new FunctionsRegistry({
      config: new Reactive({
        siteInfo: {
          functions_config: {
            timeout: 45,
          },
        },
      }),
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: 45,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('prefers functions_timeout over functions_config.timeout for sync functions', () => {
    const registry = new FunctionsRegistry({
      config: new Reactive({
        siteInfo: {
          functions_timeout: 60,
          functions_config: {
            timeout: 45,
          },
        },
      }),
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: 60,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('uses override timeouts when provided', () => {
    const registry = new FunctionsRegistry({
      config: new Reactive({
        siteInfo: {
          functions_timeout: 60,
        },
      }),
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
      timeouts: {
        syncFunctions: 120,
        backgroundFunctions: 1800,
      },
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: 120,
      backgroundFunctions: 1800,
    })
  })

  test('allows partial override of timeouts', () => {
    const registry = new FunctionsRegistry({
      config: new Reactive({
        siteInfo: {
          functions_timeout: 60,
        },
      }),
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
      timeouts: {
        syncFunctions: 120,
      },
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: 120,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('falls back to defaults when siteInfo is undefined', () => {
    const registry = new FunctionsRegistry({
      config: new Reactive({
        siteInfo: undefined,
      }),
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: SYNCHRONOUS_FUNCTION_TIMEOUT,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })

  test('falls back to defaults when config is empty object', () => {
    const registry = new FunctionsRegistry({
      config: new Reactive({}),
      destPath: '/tmp/test',
      projectRoot: '/tmp/project',
      settings: {},
    })

    expect(registry.timeouts).toEqual({
      syncFunctions: SYNCHRONOUS_FUNCTION_TIMEOUT,
      backgroundFunctions: BACKGROUND_FUNCTION_TIMEOUT,
    })
  })
})
