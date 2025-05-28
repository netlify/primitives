import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const templatesPath = dirname(fileURLToPath(import.meta.url))
const functionErrorTemplatePath = resolve(templatesPath, '../src/templates/function-error.html')

let errorTemplateFile: string

export const renderFunctionErrorPage = async (errString: string, functionType: string) => {
  const errorDetailsRegex = /<!--@ERROR-DETAILS-->/g
  const functionTypeRegex = /<!--@FUNCTION-TYPE-->/g

  try {
    errorTemplateFile = errorTemplateFile || (await readFile(functionErrorTemplatePath, 'utf-8'))

    return errorTemplateFile.replace(errorDetailsRegex, errString).replace(functionTypeRegex, functionType)
  } catch (error) {
    return errString
  }
}
