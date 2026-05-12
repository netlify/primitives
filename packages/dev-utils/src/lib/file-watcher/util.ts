import { debounce } from 'dettle'

import type { FileWatchCallback } from './index.js'

export interface DebouncedBatch {
  push(path: string): void
}

export function ensureArray(input: string | string[]): string[] {
  return Array.isArray(input) ? input : [input]
}

export function createDebouncedBatch(callback: FileWatchCallback | undefined, debounceMs: number): DebouncedBatch {
  const queue: string[] = []

  const flush = debounce(
    () => {
      if (queue.length === 0) {
        return
      }

      const batch = [...queue]
      queue.length = 0

      callback?.(batch)
    },
    debounceMs,
    { leading: true },
  )

  return {
    push(filePath: string) {
      queue.push(filePath)
      flush()
    },
  }
}

export function pathSetsEqual(existing: Set<string>, incoming: string[]): boolean {
  if (existing.size !== incoming.length) {
    return false
  }

  for (const p of incoming) {
    if (!existing.has(p)) {
      return false
    }
  }

  return true
}
