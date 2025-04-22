export function sleep<T>(ms: number, value?: T) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
