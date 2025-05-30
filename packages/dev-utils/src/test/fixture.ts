import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { EOL } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

import tmp from 'tmp-promise'

const run = promisify(exec)
export class Fixture {
  directory?: tmp.DirectoryResult
  files: Record<string, string>
  npmDependencies: Record<string, string>

  constructor() {
    this.files = {}
    this.npmDependencies = {}
  }

  private ensureDirectory() {
    if (!this.directory) {
      throw new Error("Fixture hasn't been initialized. Did you call `create()`?")
    }

    return this.directory.path
  }

  private async installNpmDependencies() {
    if (Object.keys(this.npmDependencies).length === 0) {
      return
    }

    const directory = this.ensureDirectory()
    const packageJSON = {
      name: 'fixture',
      version: '0.0.0',
      dependencies: this.npmDependencies,
    }
    const packageJSONPath = join(directory, 'package.json')

    await fs.writeFile(packageJSONPath, JSON.stringify(packageJSON, null, 2))
    await run('npm install', { cwd: directory })
  }

  async create() {
    if (!this.directory) {
      this.directory = await tmp.dir({ unsafeCleanup: true })

      // `/var` is a symlink to `/private/var`, which causes unexpected behavior
      // in the file watching logic, so we use the linked directory instead.
      // TODO: Find a better way to do this. Maybe this is an issue that needs to
      // be solved upstream in `@netlify/zip-it-and-ship-it`.
      if (this.directory.path.startsWith('/var/')) {
        this.directory.path = this.directory.path.replace('/var/', '/private/var/')
      }
    }

    for (const relativePath in this.files) {
      const filePath = join(this.directory.path, relativePath)

      await fs.mkdir(dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, this.files[relativePath])
    }

    await this.installNpmDependencies()

    return this.directory.path
  }

  async deleteFile(path: string) {
    const filePath = join(this.ensureDirectory(), path)

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
    this.files[path] = contents

    return this
  }

  withHeadersFile({
    headers = [],
    pathPrefix = '',
  }: {
    headers?: { headers: string[]; path: string }[]
    pathPrefix?: string
  }) {
    const dest = join(pathPrefix, '_headers')
    const contents = headers
      .map(
        ({ headers: headersValues, path: headerPath }) =>
          `${headerPath}${EOL}${headersValues.map((header) => `  ${header}`).join(EOL)}`,
      )
      .join(EOL)

    return this.withFile(dest, contents)
  }

  withStateFile(state: object) {
    this.files['.netlify/state.json'] = JSON.stringify(state)

    return this
  }

  async writeFile(path: string, contents: string) {
    const filePath = join(this.ensureDirectory(), path)

    await fs.writeFile(filePath, contents)
  }

  withPackages(packages: Record<string, string>) {
    this.npmDependencies = { ...this.npmDependencies, ...packages }

    return this
  }
}
