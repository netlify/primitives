import { EventEmitter } from 'node:events'

import type { DevEvent } from '../lib/event.js'

const DEFAULT_TIMEOUT = 5000

interface EventInspectorOptions {
  debug?: boolean
}

export class EventInspector extends EventEmitter {
  debug: boolean
  events: DevEvent[]

  constructor({ debug }: EventInspectorOptions = {}) {
    super()

    this.debug = debug === true
    this.events = []
  }

  handleEvent(event: DevEvent) {
    this.events.push(event)

    this.emit('eventReceived', event)
  }

  waitFor(filter: (event: DevEvent) => boolean, timeoutMs = DEFAULT_TIMEOUT) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`\`waitFor\` timed out after ${timeoutMs} ms`))
      }, timeoutMs)

      this.on('eventReceived', (event: DevEvent) => {
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
