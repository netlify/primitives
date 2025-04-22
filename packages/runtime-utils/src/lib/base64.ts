
// eslint-disable-next-line n/prefer-global/buffer
export const base64Decode =  globalThis.Buffer ? (input: string) => Buffer.from(input, 'base64').toString() : (input: string) => atob(input)

// eslint-disable-next-line n/prefer-global/buffer
export const base64Encode = globalThis.Buffer ? (input: string) => Buffer.from(input).toString('base64') : (input: string) => btoa(input)
