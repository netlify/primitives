import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

import tmp from 'tmp-promise'

const run = promisify(exec)
export class Fixture {
  directory?: tmp.DirectoryResult
  files: { contents: string; path: string }[]
  npmDependencies: Record<string, string>

  constructor() {
    this.files = []
    this.npmDependencies = {}
  }

  private async installNpmDependencies() {
    if (Object.keys(this.npmDependencies).length === 0) {
      return
    }

    if (!this.directory) {
      throw new Error("Fixture hasn't been initialized. Did you call `create()`?")
    }

    const packageJSON = {
      name: 'fixture',
      version: '0.0.0',
      dependencies: this.npmDependencies,
    }
    const packageJSONPath = join(this.directory.path, 'package.json')

    await fs.writeFile(packageJSONPath, JSON.stringify(packageJSON, null, 2))
    await run('npm install', { cwd: this.directory.path })
  }

  async create() {
    this.directory = await tmp.dir({ unsafeCleanup: true })

    // `/var` is a symlink to `/private/var`, which causes unexpected behavior
    // in the file watching logic, so we use the linked directory instead.
    // TODO: Find a better way to do this. Maybe this is an issue that needs to
    // be solved upstream in `@netlify/zip-it-and-ship-it`.
    if (this.directory.path.startsWith('/var/')) {
      this.directory.path = this.directory.path.replace('/var/', '/private/var/')
    }

    for (const file of this.files) {
      const filePath = join(this.directory.path, file.path)

      await fs.mkdir(dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, file.contents)
    }

    await this.installNpmDependencies()

    return this.directory.path
  }

  async deleteFile(path: string) {
    if (!this.directory) {
      throw new Error("Fixture hasn't been initialized. Did you call `create()`?")
    }

    const filePath = join(this.directory.path, path)

    try {
      await fs.rm(filePath, { force: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }

  async destroy() {
    await fs.rm(this.directory!.path, { force: true, recursive: true })
  }

  withFile(path: string, contents: string) {
    this.files.push({ contents, path })

    return this
  }

  withStateFile(state: object) {
    this.files.push({ contents: JSON.stringify(state), path: '.netlify/state.json' })

    return this
  }

  async writeFile(path: string, contents: string) {
    if (!this.directory) {
      throw new Error("Fixture hasn't been initialized. Did you call `create()`?")
    }

    const filePath = join(this.directory.path, path)

    await fs.writeFile(filePath, contents)
  }

  withPackages(packages: Record<string, string>) {
    this.npmDependencies = { ...this.npmDependencies, ...packages }

    return this
  }
}
