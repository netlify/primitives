import { type Header, type MinimalHeader, parseAllHeaders } from '@netlify/headers-parser'

export const parseHeaders = async function ({
  // XXX(serhalp): improve this name?
  configHeaders,
  configPath,
  headersFiles,
}: {
  configHeaders?: MinimalHeader[] | undefined
  configPath?: string | undefined
  headersFiles?: string[] | undefined
}): Promise<Header[]> {
  const { errors, headers } = await parseAllHeaders({
    headersFiles,
    netlifyConfigPath: configPath,
    minimal: false,
    configHeaders: configHeaders ?? [],
  })
  handleHeadersErrors(errors)
  // TODO(serhalp): Make `parseAllHeaders()` smart enough to conditionally return a refined type based on `minimal`
  return headers as Header[]
}

const handleHeadersErrors = function (errors: Error[]) {
  if (errors.length === 0) {
    return
  }

  const errorMessage = errors.map(({ message }) => message).join('\n\n')
  // XXX(serhalp): determine error logging pattern
  console.error(`Headers syntax errors:\n${errorMessage}`)
}
