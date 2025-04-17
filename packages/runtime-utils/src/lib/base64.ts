export const base64Decode = (input: string) => {
  // eslint-disable-next-line n/prefer-global/buffer
  const { Buffer } = globalThis

  if (Buffer) {
    return Buffer.from(input, 'base64').toString()
  }

  return atob(input)
}

export const base64Encode = (input: string) => {
  // eslint-disable-next-line n/prefer-global/buffer
  const { Buffer } = globalThis

  if (Buffer) {
    return Buffer.from(input).toString('base64')
  }

  return btoa(input)
}
