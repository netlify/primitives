const UNIT_TO_MB: Record<string, number> = { mb: 1, gb: 1024 }
const PATTERN = /^(\d+(?:\.\d+)?)\s*(mb|gb)?$/

/**
 * Converts a size to megabytes. A number is a count of megabytes, and a string
 * is a number that can be followed by `mb` or `gb`, such as `"512mb"` or
 * `"4gb"`. Returns `NaN` for a string in any other form.
 */
export const parseSizeMB = (input: number | string): number => {
  if (typeof input === 'number') {
    return input
  }

  const match = PATTERN.exec(input.trim().toLowerCase())
  if (!match) {
    return Number.NaN
  }

  const [, value, unit = 'mb'] = match

  return parseFloat(value) * UNIT_TO_MB[unit]
}
