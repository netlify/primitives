import path from 'node:path'

import type { Logger } from '@netlify/dev-utils'

import { type ConfigHeader, parseHeaders } from './lib/parseHeaders.js'
import { headersForPath } from './lib/headersForPath.js'

const HEADERS_FILE_NAME = '_headers'

export type HeadersCollector = (key: string, value: string) => void

interface HeadersHandlerOptions {
  configPath?: string | undefined
  configHeaders?: ConfigHeader[] | undefined
  /**
   * Base directory of the project. This can be absolute or relative
   * to the current working directory.
   */
  projectDir: string
  /**
   * Publish directory of the project, relative to the `projectDir`.
   */
  publishDir?: string | undefined
  logger: Logger
}

export class HeadersHandler {
  #configHeaders: ConfigHeader[] | undefined
  #configPath: string | undefined
  #headersFiles: string[]
  #logger: Logger

  constructor({ configPath, configHeaders, projectDir, publishDir, logger }: HeadersHandlerOptions) {
    this.#configHeaders = configHeaders
    this.#configPath = configPath
    this.#logger = logger
    // Project dir is resolved relative to cwd
    const projectDirHeadersFile = path.resolve(projectDir, HEADERS_FILE_NAME)
    // Publish dir is resolved relative to project dir
    const publishDirHeadersFile = publishDir ? path.resolve(projectDir, publishDir, HEADERS_FILE_NAME) : undefined
    this.#headersFiles = [
      ...new Set([projectDirHeadersFile, ...(publishDirHeadersFile ? [publishDirHeadersFile] : [])]),
    ]
  }

  get headersFiles() {
    return this.#headersFiles
  }

  async apply(request: Request, response?: Response, collector?: HeadersCollector) {
    const headerRules = await parseHeaders({
      headersFiles: this.#headersFiles,
      configPath: this.#configPath,
      configHeaders: this.#configHeaders,
      logger: this.#logger,
    })
    const matchingHeaderRules = headersForPath(headerRules, new URL(request.url).pathname)

    for (const [key, value] of Object.entries(matchingHeaderRules)) {
      response?.headers.set(key, value)

      collector?.(key, value)
    }

    return matchingHeaderRules
  }
}
