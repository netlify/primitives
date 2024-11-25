import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'

import tmp from 'tmp-promise'

export class Fixture {
  directory?: tmp.DirectoryResult
  files: { contents: string; path: string }[]

  constructor() {
    this.files = []
  }

  async create() {
    this.directory = await tmp.dir({ unsafeCleanup: true })

    for (const file of this.files) {
      const filePath = join(this.directory.path, file.path)

      await fs.mkdir(dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, file.contents)
    }

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

  async writeFile(path: string, contents: string) {
    if (!this.directory) {
      throw new Error("Fixture hasn't been initialized. Did you call `create()`?")
    }

    const filePath = join(this.directory.path, path)

    await fs.writeFile(filePath, contents)
  }
}
