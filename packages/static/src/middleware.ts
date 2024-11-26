import { createReadStream, promises as fs } from 'node:fs'
import path from "node:path"
import { Readable } from 'node:stream'

import { Middleware } from '@netlify/dev'
import mime from "mime-types"

import { fileExists, getReadableStreamFromFile } from './lib/fs.js'
import { getFilePathsForURL } from './lib/paths.js'

interface WithStaticOptions {
  directory: string
}

const staticHeaders = {
  age: "0",
  "cache-control": 'public, max-age=0, must-revalidate'
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

      const stream = getReadableStreamFromFile(possiblePath)

      return new Response(stream, { headers, status: 200 })
    }

    return next(request, context)
  }
}
