import { describe, expect, test, vi } from 'vitest'

import { Reactive } from './reactive.js'

describe('Reactive', () => {
  test('get() returns the initial value', () => {
    const value = new Reactive({ port: 3000 })

    expect(value.get()).toEqual({ port: 3000 })
  })

  test('set() updates the value', () => {
    const value = new Reactive({ port: 3000 })

    value.set({ port: 8080 })

    expect(value.get()).toEqual({ port: 8080 })
  })

  test('subscribe() is called when value changes', () => {
    const value = new Reactive({ port: 3000 })
    const callback = vi.fn()

    value.subscribe(callback)
    value.set({ port: 8080 })

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith({ port: 8080 })
  })

  test('multiple subscribers are all notified', () => {
    const value = new Reactive('initial')
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    value.subscribe(callback1)
    value.subscribe(callback2)
    value.set('updated')

    expect(callback1).toHaveBeenCalledWith('updated')
    expect(callback2).toHaveBeenCalledWith('updated')
  })

  test('unsubscribe stops notifications', () => {
    const value = new Reactive('initial')
    const callback = vi.fn()

    const unsubscribe = value.subscribe(callback)
    value.set('first')
    expect(callback).toHaveBeenCalledOnce()

    unsubscribe()
    value.set('second')
    expect(callback).toHaveBeenCalledOnce()
  })

  test('set() notifies even if value is the same reference', () => {
    const obj = { port: 3000 }
    const value = new Reactive(obj)
    const callback = vi.fn()

    value.subscribe(callback)
    value.set(obj)

    expect(callback).toHaveBeenCalledOnce()
  })
})
