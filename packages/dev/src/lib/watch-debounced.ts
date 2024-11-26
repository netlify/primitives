import { once } from 'node:events'

import chokidar from 'chokidar'
import decache from 'decache'
import debounce from 'lodash.debounce'

const DEBOUNCE_WAIT = 100

interface WatchDebouncedOptions {
  depth?: number
  ignored?: (string | RegExp)[]
  onAdd?: (paths: string[]) => void
  onChange?: (paths: string[]) => void
  onUnlink?: (paths: string[]) => void
}

const noOp = () => {
  // no-op
}

/**
 * Adds a file watcher to a path or set of paths and debounces the events.
 */
export const watchDebounced = async (
  target: string | string[],
  { depth, ignored = [], onAdd = noOp, onChange = noOp, onUnlink = noOp }: WatchDebouncedOptions,
) => {
  const baseIgnores = [/\/(node_modules|.git)\//]
  const watcher = chokidar.watch(target, { depth, ignored: [...baseIgnores, ...ignored], ignoreInitial: true })

  await once(watcher, 'ready')

  let onChangeQueue: string[] = []
  let onAddQueue: string[] = []
  let onUnlinkQueue: string[] = []

  const debouncedOnChange = debounce(() => {
    onChange(onChangeQueue)
    onChangeQueue = []
  }, DEBOUNCE_WAIT)
  const debouncedOnAdd = debounce(() => {
    onAdd(onAddQueue)
    onAddQueue = []
  }, DEBOUNCE_WAIT)
  const debouncedOnUnlink = debounce(() => {
    onUnlink(onUnlinkQueue)
    onUnlinkQueue = []
  }, DEBOUNCE_WAIT)

  watcher
    .on('change', (path) => {
      decache(path)
      onChangeQueue.push(path)
      debouncedOnChange()
    })
    .on('unlink', (path) => {
      decache(path)
      onUnlinkQueue.push(path)
      debouncedOnUnlink()
    })
    .on('add', (path) => {
      decache(path)
      onAddQueue.push(path)
      debouncedOnAdd()
    })

  return watcher
}
