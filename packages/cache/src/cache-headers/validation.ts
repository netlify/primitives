export const ensureArray = (value: any): string[] => (Array.isArray(value) ? value : [value])

export const requireArrayOfStrings = (name: string, value: any): string[] => {
  if (!Array.isArray(value) || value.some((part) => typeof part !== 'string' || part.length === 0)) {
    throw new TypeError(`'${name}' must be an array of strings.`)
  }

  return value
}

export const requireArrayOfStringsWithNesting = (name: string, value: any, joiner: string): string[] => {
  if (!Array.isArray(value)) {
    throw new TypeError(`'${name}' must be an array.`)
  }

  return value.map((part, index) => {
    if (typeof part === 'string') {
      return part
    }

    return requireArrayOfStrings(`${name}[${index}]`, part).join(joiner)
  })
}

export const requirePositiveInteger = (name: string, value: any) => {
  const number = typeof value === 'number' ? value : Number.parseInt(value)

  if (Number.isNaN(number) || !Number.isInteger(number) || number < 0) {
    throw new TypeError(`'${name}' must be a positive integer number.`)
  }

  return number
}
