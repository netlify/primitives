export const base64Decode = globalThis.Buffer
  ? (input: string) => Buffer.from(input, 'base64').toString()
  : (input: string) => atob(input)

export const base64Encode = globalThis.Buffer
  ? (input: string) => Buffer.from(input).toString('base64')
  : (input: string) => btoa(input)
