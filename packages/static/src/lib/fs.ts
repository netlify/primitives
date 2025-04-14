import { createReadStream, promises as fs } from 'node:fs'
import { Readable } from 'node:stream'

export const fileExists = async (path: string) => {
  try {
    const stat = await fs.stat(path)

    if (stat.isFile()) {
      return true
    }
  } catch {
    // no-op
  }

  return false
}

export const getReadableStreamFromFile = (path: string) => {
  const stream = createReadStream(path)
  
  return Readable.toWeb(stream) as ReadableStream
}
