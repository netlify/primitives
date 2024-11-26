import { createReadStream, promises as fs } from 'node:fs'
import path from "node:path"
import { Readable } from 'node:stream'

import { Middleware } from '@netlify/dev-utils'
import mime from "mime-types"

import { getFilePathsForURL } from './paths.js'

interface WithStaticOptions {
  directory: string
}

const staticHeaders = {
  age: "0",
  "cache-control": 'public, max-age=0, must-revalidate'
}

const fileExists = async (path: string) => {
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

export const withStatic = (options: WithStaticOptions): Middleware => {
  const { directory } = options

  return async (request, context, next) => {
    const url = new URL(request.url)
    const possiblePaths = getFilePathsForURL(url.pathname, directory)

    for (const possiblePath of possiblePaths) {
      if (!(await fileExists(possiblePath))) {
        continue
      }

      const headers = new Headers(staticHeaders)
      const contentType = mime.contentType(path.extname(possiblePath))

      if (contentType) {
        headers.set("content-type", contentType)
      }

      const stream = Readable.toWeb(createReadStream(possiblePath))

      // @ts-expect-error TODO: Figure out why TS is complaining about a type
      // mismatch.
      return new Response(stream, { headers, status: 200 })
    }

    return next(request, context)
  }
}
