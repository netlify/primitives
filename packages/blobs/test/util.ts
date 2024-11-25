import { Buffer } from 'node:buffer'

export const base64Encode = (input: string | object) => {
  const payload = typeof input === 'string' ? input : JSON.stringify(input)

  return Buffer.from(payload).toString('base64')
}

export const streamToString = async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chunks: Array<any> = []

  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  const buffer = Buffer.concat(chunks)

  return buffer.toString('utf-8')
}
