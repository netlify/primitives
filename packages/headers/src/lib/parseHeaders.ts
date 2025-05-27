import type { Logger } from '@netlify/dev-utils'
import { type Header, type MinimalHeader as ConfigHeader, parseAllHeaders } from '@netlify/headers-parser'

export type { ConfigHeader, Header }

export const parseHeaders = async function ({
  configHeaders,
  configPath,
  headersFiles,
  logger,
}: {
  configHeaders?: ConfigHeader[] | undefined
  configPath?: string | undefined
  headersFiles?: string[] | undefined
  logger: Logger
}): Promise<Header[]> {
  const { errors, headers } = await parseAllHeaders({
    headersFiles,
    netlifyConfigPath: configPath,
    minimal: false,
    configHeaders: configHeaders ?? [],
  })
  handleHeadersErrors(errors, logger)
  // TODO(serhalp): Make `parseAllHeaders()` smart enough to conditionally return a refined type based on `minimal`
  return headers as Header[]
}

const handleHeadersErrors = function (errors: Error[], logger: Logger) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(({ message }) => message).join('\n\n')
  logger.error(`Headers syntax errors:\n${errorMessage}`)
}
