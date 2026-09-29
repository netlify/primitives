import type { WebSocket as WsWebSocket } from 'ws'

/**
 * Fired when a WebSocket connection closes, with the same fields as the
 * browser's `CloseEvent`.
 */
export class CloseEvent extends Event {
  readonly code: number
  readonly reason: string
  readonly wasClean: boolean

  constructor(type: string, init: { code?: number; reason?: string; wasClean?: boolean } = {}) {
    super(type)
    this.code = init.code ?? 0
    this.reason = init.reason ?? ''
    this.wasClean = init.wasClean ?? false
  }
}

/**
 * The server side of a WebSocket connection, with the same interface as the
 * browser's `WebSocket`.
 */
export class WebSocket extends EventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  #binaryType: BinaryType = 'blob'
  #ws: WsWebSocket

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(ws: WsWebSocket) {
    super()

    this.#ws = ws

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      let payload: ArrayBuffer | Blob | string

      if (!isBinary) {
        payload = data.toString()
      } else if (this.#binaryType === 'arraybuffer') {
        payload = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
      } else {
        payload = new Blob([new Uint8Array(data)])
      }

      this.#emit(new MessageEvent('message', { data: payload }), this.onmessage)
    })

    ws.on('close', (code: number, reason: Buffer) => {
      this.#emit(new CloseEvent('close', { code, reason: reason.toString(), wasClean: code === 1000 }), this.onclose)
    })

    ws.on('error', () => {
      this.#emit(new Event('error'), this.onerror)
    })

    // The handshake is already complete. Firing `open` on a microtask gives
    // the caller a chance to attach its listeners first.
    queueMicrotask(() => {
      this.#emit(new Event('open'), this.onopen)
    })
  }

  #emit<E extends Event>(event: E, handler: ((event: E) => void) | null) {
    handler?.(event)
    this.dispatchEvent(event)
  }

  get readyState(): number {
    return this.#ws.readyState
  }

  get protocol(): string {
    return this.#ws.protocol
  }

  get extensions(): string {
    return this.#ws.extensions
  }

  get bufferedAmount(): number {
    return this.#ws.bufferedAmount
  }

  get binaryType(): BinaryType {
    return this.#binaryType
  }

  set binaryType(value: BinaryType) {
    // Like browsers, ignore values that aren't valid.
    const type: string = value

    if (type === 'blob' || type === 'arraybuffer') {
      this.#binaryType = value
    }
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.#ws.readyState !== WebSocket.OPEN) {
      throw new DOMException('WebSocket is not open', 'InvalidStateError')
    }

    this.#ws.send(data)
  }

  close(code?: number, reason?: string): void {
    this.#ws.close(code, reason)
  }
}
