import type { SerializedError } from '../../shared/types.ts'

/**
 * A message that asks a worker to retrieve the configuration objects for a set
 * of functions.
 */
export interface ConfigRequestMessage {
  type: 'configRequest'
  data: {
    functions: Record<string, string>
  }
}

/**
 * A message produced by a worker that contains the configuration objects for a
 * set of functions.
 */
export interface ConfigResponseMessage {
  type: 'configResponse'
  data: {
    configs: Record<string, object>
    errors: Record<string, SerializedError>
  }
}

/**
 * A message that asks a worker to run a chain of edge functions for a given
 * request, serialized in the `data` field.
 */
export interface RunRequestMessage {
  type: 'request'
  data: {
    body: ArrayBuffer
    functions: Record<string, string>
    headers: Record<string, string>
    method: string
    timeout: number
    url: string
  }
}

/**
 * A message produced by a worker that represents the beginning of a `Response`
 * object, holding the headers and the status code.
 */
export interface RunResponseStartMessage {
  type: 'responseStart'
  data: {
    headers: Record<string, string>
    status: number
    hasBody: boolean
  }
}

/**
 * A message produced by a worker that holds a chunk of a `Response` body.
 */
export interface RunResponseChunkMessage {
  type: 'responseChunk'
  data: {
    chunk: Uint8Array | undefined
  }
}

/**
 * A message produced by a worker that represents the end of a `Response` body.
 */
export interface RunResponseEndMessage {
  type: 'responseEnd'
}

export type Message =
  | ConfigRequestMessage
  | ConfigResponseMessage
  | RunRequestMessage
  | RunResponseChunkMessage
  | RunResponseEndMessage
  | RunResponseStartMessage
