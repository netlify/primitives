import { EventEmitter } from 'node:events'

const DEFAULT_TIMEOUT = 5000

interface InspectableEvent {
  name: string
}

interface EventInspectorOptions {
  debug?: boolean
}

export class EventInspector extends EventEmitter {
  debug: boolean
  events: InspectableEvent[]

  constructor({ debug }: EventInspectorOptions = {}) {
    super()

    this.debug = debug === true
    this.events = []
  }

  handleEvent(event: InspectableEvent) {
    this.events.push(event)

    this.emit('eventReceived', event)
  }

  waitFor(filter: (event: InspectableEvent) => boolean, timeoutMs = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`\`waitFor\` timed out after ${timeoutMs} ms`))
      }, timeoutMs)

      this.on('eventReceived', (event: InspectableEvent) => {
        if (this.debug) {
          console.log('[EventInspector] Event received:', event)
        }

        if (filter(event)) {
          resolve(event)
        }
      })
    })
  }
}
