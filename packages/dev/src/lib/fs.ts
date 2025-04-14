import { promises as fs } from 'node:fs'

export const isDirectory = async (path: string) => {
  try {
    const stat = await fs.stat(path)

    return stat.isDirectory()
  } catch {
    // no-op
  }

  return false
}

export const isFile = async (path: string) => {
  try {
    const stat = await fs.stat(path)

    return stat.isFile()
  } catch {
    // no-op
  }

  return false
}
