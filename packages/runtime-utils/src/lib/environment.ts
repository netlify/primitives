export interface EnvironmentVariables {
  delete: (key: string) => void
  get: (key: string) => string | undefined
  has: (key: string) => boolean
  set: (key: string, value: string) => void
  toObject: () => Record<string, string>
}

interface Globals {
  Deno?: {
    env: EnvironmentVariables
  }
  Netlify?: {
    env: EnvironmentVariables
  }
  process?: {
    env: Record<string, string>
  }
}

/**
 * Returns a cross-runtime interface for handling environment variables. It
 * uses the `Netlify.env` global if available, otherwise looks for `Deno.env`
 * and `process.env`.
 */
export const getEnvironment = (): EnvironmentVariables => {
  const { Deno, Netlify, process } = globalThis as Globals

  return (
    Netlify?.env ??
    Deno?.env ?? {
      delete: (key: string) => delete process?.env[key],
      get: (key: string) => process?.env[key],
      has: (key: string) => Boolean(process?.env[key]),
      set: (key: string, value: string) => {
        if (process?.env) {
          process.env[key] = value
        }
      },
      toObject: () => process?.env ?? {},
    }
  )
}
