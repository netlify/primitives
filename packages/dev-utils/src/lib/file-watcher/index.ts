import { createRequire } from 'node:module'
import path from 'node:path'

import chokidar from 'chokidar'

import { createDebouncedBatch, ensureArray, pathSetsEqual, type DebouncedBatch } from './util.js'

const require = createRequire(import.meta.url)

const DEFAULT_DEBOUNCE_MS = 100
const BASE_IGNORES = [/\/(node_modules|\.git)\//]

export type FileWatchEventType = 'add' | 'change' | 'unlink'
export type FileWatchCallback = (paths: string[]) => void

export interface FileWatchSubscriptionOptions {
  /**
   * An optional identifier for this subscription. When provided, calling
   * `subscribe` again with the same `id` is idempotent: if the paths haven't
   * changed, the existing handle is returned as-is. If the paths have changed,
   * the old subscription is automatically replaced.
   */
  id?: string

  /**
   * One or more file or directory paths to watch.
   */
  paths: string | string[]

  /**
   * Called when a watched file's contents change.
   */
  onChange?: FileWatchCallback

  /**
   * Called when a new file is created inside a watched directory.
   */
  onAdd?: FileWatchCallback

  /**
   * Called when a watched file is deleted.
   */
  onUnlink?: FileWatchCallback

  /**
   * Maximum directory depth to watch. For example, `depth: 1` only watches
   * files directly inside the watched directory, not in subdirectories.
   */
  depth?: number

  /**
   * How long to wait (in milliseconds) before delivering a batch of events.
   * Defaults to 100ms.
   */
  debounceMs?: number

  /**
   * Whether to clear the Node.js `require` cache for changed files before
   * delivering the event. Useful for hot-reloading CommonJS modules.
   */
  decache?: boolean
}

export interface FileWatchSubscriptionHandle {
  add(paths: string | string[]): void
  unwatch(paths: string | string[]): void
  unsubscribe(): void
}

interface Subscription {
  id: string
  watchedPaths: Set<string>
  depth?: number
  decache: boolean
  batchers: Record<FileWatchEventType, DebouncedBatch>
}

export class FileWatcher {
  /**
   * The shared chokidar instance that backs all subscriptions.
   */
  #watcher: ReturnType<typeof chokidar.watch>

  /**
   * Auto-incrementing counter for generating unique internal subscription IDs.
   */
  #nextSubscriptionId = 0

  /**
   * Maps subscription IDs to their internal state (watched paths, callbacks,
   * debounce queues, etc.).
   */
  #subscriptions = new Map<string, Subscription>()

  /**
   * Maps subscription IDs to the handles returned to callers. This is used
   * to return the same handle when a named subscription is called again with
   * unchanged paths.
   */
  #handles = new Map<string, FileWatchSubscriptionHandle>()

  /**
   * Reference count for each watched path. A path is only added to chokidar
   * when its count goes from 0 to 1, and only removed when it drops back to
   * 0. This lets multiple subscriptions share the same underlying watch.
   */
  #pathRefCounts = new Map<string, number>()

  constructor(options?: { ignored?: (string | RegExp)[] }) {
    const ignored = [...BASE_IGNORES, ...(options?.ignored ?? [])]

    this.#watcher = chokidar.watch([], {
      ignored,
      ignoreInitial: true,
    })

    this.#watcher.on('add', (filePath) => {
      this.#dispatch('add', filePath)
    })
    this.#watcher.on('change', (filePath) => {
      this.#dispatch('change', filePath)
    })
    this.#watcher.on('unlink', (filePath) => {
      this.#dispatch('unlink', filePath)
    })
  }

  subscribe(options: FileWatchSubscriptionOptions): FileWatchSubscriptionHandle {
    const paths = ensureArray(options.paths)

    // If an `id` was provided and a subscription with that id already exists,
    // check whether the paths have changed. If not, return the existing handle.
    // If they have, tear down the old subscription and fall through to create
    // a new one with the same id.
    if (options.id !== undefined) {
      const existingSubscription = this.#subscriptions.get(options.id)
      const existingHandle = this.#handles.get(options.id)

      if (existingSubscription && existingHandle) {
        if (pathSetsEqual(existingSubscription.watchedPaths, paths)) {
          return existingHandle
        }

        this.#unsubscribe(options.id)
      }
    }

    const id = options.id ?? String(this.#nextSubscriptionId++)
    const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS

    const subscription: Subscription = {
      id,
      watchedPaths: new Set(paths),
      depth: options.depth,
      decache: options.decache === true,
      batchers: {
        add: createDebouncedBatch(options.onAdd, debounceMs),
        change: createDebouncedBatch(options.onChange, debounceMs),
        unlink: createDebouncedBatch(options.onUnlink, debounceMs),
      },
    }

    this.#subscriptions.set(id, subscription)

    // Add paths to chokidar
    for (const p of paths) {
      this.#addPathRef(p)
    }

    const handle: FileWatchSubscriptionHandle = {
      add: (newPaths) => {
        const normalized = ensureArray(newPaths)

        for (const p of normalized) {
          if (!subscription.watchedPaths.has(p)) {
            subscription.watchedPaths.add(p)
            this.#addPathRef(p)
          }
        }
      },
      unwatch: (removePaths) => {
        const normalized = ensureArray(removePaths)

        for (const p of normalized) {
          if (subscription.watchedPaths.has(p)) {
            subscription.watchedPaths.delete(p)
            this.#removePathRef(p)
          }
        }
      },
      unsubscribe: () => {
        this.#unsubscribe(id)
      },
    }

    this.#handles.set(id, handle)

    return handle
  }

  async close(): Promise<void> {
    this.#subscriptions.clear()
    this.#handles.clear()
    this.#pathRefCounts.clear()
    await this.#watcher.close()
  }

  #dispatch(eventType: FileWatchEventType, filePath: string) {
    for (const subscription of this.#subscriptions.values()) {
      if (!this.#isPathRelevant(filePath, subscription)) {
        continue
      }

      if (subscription.decache) {
        try {
          const decacheFn = require('decache') as (path: string) => void
          decacheFn(filePath)
        } catch {
          // decache may fail for non-CJS modules, ignore
        }
      }

      subscription.batchers[eventType].push(filePath)
    }
  }

  #isPathRelevant(filePath: string, subscription: Subscription): boolean {
    for (const watchedPath of subscription.watchedPaths) {
      // Exact match (file watching)
      if (filePath === watchedPath) {
        return true
      }

      // Directory containment
      const relative = path.relative(watchedPath, filePath)

      // If the relative path starts with "..", the file is not inside this directory
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        continue
      }

      // Check depth constraint
      if (subscription.depth !== undefined) {
        const depth = relative.split(path.sep).length
        if (depth > subscription.depth) {
          continue
        }
      }

      return true
    }

    return false
  }

  #addPathRef(watchedPath: string) {
    const count = this.#pathRefCounts.get(watchedPath) ?? 0

    if (count === 0) {
      this.#watcher.add(watchedPath)
    }

    this.#pathRefCounts.set(watchedPath, count + 1)
  }

  #removePathRef(watchedPath: string) {
    const count = this.#pathRefCounts.get(watchedPath) ?? 0

    if (count <= 1) {
      this.#watcher.unwatch(watchedPath)
      this.#pathRefCounts.delete(watchedPath)
    } else {
      this.#pathRefCounts.set(watchedPath, count - 1)
    }
  }

  #unsubscribe(id: string) {
    const subscription = this.#subscriptions.get(id)

    if (!subscription) {
      return
    }

    for (const p of subscription.watchedPaths) {
      this.#removePathRef(p)
    }

    this.#subscriptions.delete(id)
    this.#handles.delete(id)
  }
}
