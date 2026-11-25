import { parseSizeMB } from '@netlify/runtime-utils'

import { SandboxError } from './error.js'

/**
 * An amount of memory or disk. A number is a count of megabytes, and a string
 * is a number followed by `mb` or `gb`, such as `"512mb"` or `"4gb"`.
 */
export type Size = number | string

/**
 * Returns the size given for an option as a whole number of megabytes, or
 * `undefined` when the option wasn't set. Throws when the size isn't valid.
 */
export function sizeInMB(option: string, input: Size | undefined): number | undefined {
  if (input === undefined) {
    return undefined
  }

  const megabytes = parseSizeMB(input)

  if (!Number.isInteger(megabytes) || megabytes <= 0) {
    throw new SandboxError(
      'invalid_request',
      `${option} must be a number of megabytes or a string such as "4gb", and ${JSON.stringify(input)} is neither`,
    )
  }

  return megabytes
}
