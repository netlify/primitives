type ReactiveSubscriber<T> = (newValue: T) => void

/**
 * A reactive value holder. Wraps a value and notifies subscribers when it
 * changes. Consumers call {@link get} to read the current value and
 * {@link subscribe} to be notified of updates.
 */
export class Reactive<T> {
  #value: T
  #subscribers = new Set<ReactiveSubscriber<T>>()

  constructor(initialValue: T) {
    this.#value = initialValue
  }

  /**
   * Returns the current value.
   */
  get(): T {
    return this.#value
  }

  /**
   * Replaces the current value and notifies all subscribers.
   */
  set(newValue: T): void {
    this.#value = newValue

    for (const callback of this.#subscribers) {
      callback(newValue)
    }
  }

  /**
   * Registers a callback that will be called whenever the value changes.
   * Returns an unsubscribe function.
   */
  subscribe(callback: ReactiveSubscriber<T>): () => void {
    this.#subscribers.add(callback)

    return () => {
      this.#subscribers.delete(callback)
    }
  }
}
