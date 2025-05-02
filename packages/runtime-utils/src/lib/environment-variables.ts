export interface EnvironmentVariables {
  delete: (key: string) => void
  get: (key: string) => string | undefined
  has: (key: string) => boolean
  set: (key: string, value: string) => void
  toObject: () => Record<string, string>
}
