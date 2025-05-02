import type { Context } from './context/context.js'
import type { EnvironmentVariables } from './environment-variables.js'

export type NetlifyGlobal = {
  context: Context | null
  env: EnvironmentVariables
}
