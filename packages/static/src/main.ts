import path from 'node:path'

import mime from 'mime-types'

import { fileExists, getReadableStreamFromFile } from './lib/fs.js'
import { getFilePathsForURL } from './lib/paths.js'

interface StaticHandlerOptions {
  directory: string
}

const staticHeaders = {
  age: '0',
  'cache-control': 'public, max-age=0, must-revalidate',
}

export interface StaticMatch {
  handle: () => Promise<Response>
}

export class StaticHandler {
  private publicDirectory: string

  constructor(options: StaticHandlerOptions) {
    this.publicDirectory = options.directory
  }

  async match(request: Request): Promise<StaticMatch | undefined> {
    const url = new URL(request.url)
    const possiblePaths = getFilePathsForURL(url.pathname, this.publicDirectory)

    for (const possiblePath of possiblePaths) {
      if (!(await fileExists(possiblePath))) {
        continue
      }

      const headers = new Headers(staticHeaders)
      const contentType = mime.contentType(path.extname(possiblePath))

      if (contentType) {
        headers.set('content-type', contentType)
      }

      return {
        handle: async () => {
          const stream = getReadableStreamFromFile(possiblePath)

          return new Response(stream, { headers, status: 200 })
        },
      }
    }
  }
}
