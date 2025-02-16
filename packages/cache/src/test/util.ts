export const readAsBuffer = (input: NodeJS.ReadableStream) =>
  new Promise((resolve, reject) => {
    let buffer = ''

    input.on('data', (chunk) => {
      buffer += chunk
    })

    input.on('error', (error) => {
      reject(error)
    })

    input.on('end', () => {
      resolve(buffer)
    })
  })

export function sleep<T>(ms: number, value?: T) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
