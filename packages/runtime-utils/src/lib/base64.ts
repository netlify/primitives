const getString = (input: string | object) => (typeof input === 'string' ? input : JSON.stringify(input))

export const base64Decode = globalThis.Buffer
  ? (input: string) => Buffer.from(input, 'base64').toString()
  : (input: string) => atob(input)

export const base64Encode = globalThis.Buffer
  ? (input: string | object) => Buffer.from(getString(input)).toString('base64')
  : (input: string | object) => btoa(getString(input))
