import type { NetlifyAPI } from '@netlify/api'
import type { EnvironmentVariables } from '@netlify/types'

export type EnvironmentVariableSource = 'account' | 'addons' | 'configFile' | 'general' | 'internal' | 'ui'

/**
 * Supported values for the user-provided env `context` option.
 * These all match possible `context` values returned by the Envelope API.
 * Note that a user may also specify a branch name with the special `branch:my-branch-name` format.
 */
export const SUPPORTED_CONTEXTS = ['all', 'production', 'deploy-preview', 'branch-deploy', 'dev', 'dev-server'] as const

/**
 * Additional aliases for the user-provided env `context` option.
 */
const SUPPORTED_CONTEXT_ALIASES = {
  dp: 'deploy-preview',
  prod: 'production',
}
/**
 * Supported values for the user-provided env `scope` option.
 * These exactly match possible `scope` values returned by the Envelope API.
 * Note that `any` is also supported.
 */
export const ALL_ENVELOPE_SCOPES = ['builds', 'functions', 'runtime', 'post_processing'] as const

export type EnvironmentVariable = {
  sources: EnvironmentVariableSource[]
  value: string
  scopes?: (typeof ALL_ENVELOPE_SCOPES)[]
}

export type InjectedEnvironmentVariable = {
  isInternal: boolean
  originalValue: string | undefined
  overriddenSources: string[]
  usedSource: string
  value: string
}

interface InjectEnvironmentVariablesOptions {
  accountSlug?: string
  baseVariables: Record<string, EnvironmentVariable>
  envAPI: EnvironmentVariables
  /**
   * Whether to inject user-defined environment variables.
   * When false, only platform environment variables (from 'general' and 'internal' sources)
   * are injected. When true, all environment variables are injected.
   * @default true
   */
  injectUserEnv?: boolean
  netlifyAPI?: NetlifyAPI
  siteID?: string
}

/**
 * Inject user-defined environment variables (from various sources, see `@netlify/config`)
 * into the provided `envAPI` (which may be a proxy to `process.env`, affecting the current proc),
 * if `siteID` and `accountSlug` are provided.
 * @see {@link https://github.com/netlify/build/blob/8b7583e1890636bd64b54e20aee40ae5365edeaf/packages/config/src/env/main.ts#L92}
 *
 * This also injects and returns the documented runtime env vars:
 * @see {@link https://docs.netlify.com/functions/environment-variables/#functions}
 *
 * @return Metadata about all injected environment variables
 */
export const injectEnvVariables = async ({
  accountSlug,
  baseVariables = {},
  envAPI,
  injectUserEnv = true,
  netlifyAPI,
  siteID,
}: InjectEnvironmentVariablesOptions) => {
  const results: Record<string, InjectedEnvironmentVariable> = {}

  let variables = baseVariables

  if (netlifyAPI && siteID && accountSlug) {
    variables = await getEnvelopeEnv({
      accountId: accountSlug,
      api: netlifyAPI,
      env: baseVariables,
      siteId: siteID,
    })
  }

  // Inject env vars which come from multiple `source`s and have been collected from
  // `@netlify/config` and/or Envelope. These have not been populated on the actual env yet.
  for (const [key, variable] of Object.entries(variables)) {
    // If injectUserEnv is false, only inject platform env vars (from 'general' and 'internal' sources)
    const isPlatformVar = variable.sources.includes('general') || variable.sources.includes('internal')
    if (!injectUserEnv && !isPlatformVar) {
      continue
    }

    const existsInProcess = envAPI.has(key)
    const [usedSource, ...overriddenSources] = existsInProcess ? ['process', ...variable.sources] : variable.sources
    const isInternal = variable.sources.includes('internal')
    const result: InjectedEnvironmentVariable = {
      isInternal,
      originalValue: envAPI.get(key),
      overriddenSources,
      usedSource,
      value: variable.value,
    }

    if (!existsInProcess || isInternal) {
      envAPI.set(key, variable.value)
    }

    results[key] = result
  }

  return results
}

// TODO(serhalp) Netlify API is incorrect - the returned scope is `post_processing`, not `post-processing`
type EnvelopeEnvVarScope =
  | Exclude<NonNullable<Awaited<ReturnType<NetlifyAPI['getEnvVars']>>[number]['scopes']>[number], 'post-processing'>
  | 'post_processing'
type EnvelopeEnvVar = Awaited<ReturnType<NetlifyAPI['getEnvVars']>>[number] & {
  scopes: EnvelopeEnvVarScope[]
}
type EnvelopeEnvVarContext = NonNullable<NonNullable<EnvelopeEnvVar['values']>[number]['context']>
export type EnvelopeEnvVarValue = {
  /**
   * The deploy context of the this env var value
   */
  context?: EnvelopeEnvVarContext
  /**
   * For parameterized contexts (i.e. only `branch`), context parameter (i.e. the branch name)
   */
  context_parameter?: string | undefined
  /**
   * The value of the environment variable for this context. Note that this appears to be an empty string
   * when the env var is not set for this context.
   */
  value?: string | undefined
}

export type EnvelopeItem = {
  // FIXME(serhalp) Netlify API types claim this is optional. Investigate and fix here or there.
  key: string
  scopes: EnvelopeEnvVarScope[]
  values: EnvelopeEnvVarValue[]
}

// AFAICT, Envelope uses only `post_processing` on returned env vars; the CLI documents and expects
// only `post-processing` as a valid user-provided scope; the code handles both everywhere. Consider
// explicitly normalizing and dropping undocumented support for user-provided `post_processing`.
type SupportedScope = EnvelopeEnvVarScope | 'post_processing' | 'any'

type ContextOrBranch = string

/**
 * Normalizes a user-provided "context". Note that this may be the special `branch:my-branch-name` format.
 *
 * - If this is a supported alias of a context, it will be normalized to the canonical context.
 * - Valid canonical contexts are returned as is.
 * - If this starts with `branch:`, it will be normalized to the branch name.
 *
 * @param context A user-provided context, context alias, or a string in the `branch:my-branch-name` format.
 *
 * @returns The normalized context name or just the branch name
 */
export const normalizeContext = (context: string): ContextOrBranch => {
  if (!context) {
    return context
  }

  context = context.toLowerCase()
  if (context in SUPPORTED_CONTEXT_ALIASES) {
    context = SUPPORTED_CONTEXT_ALIASES[context as keyof typeof SUPPORTED_CONTEXT_ALIASES]
  }
  const forbiddenContexts = SUPPORTED_CONTEXTS.map((ctx) => `branch:${ctx}`)
  if (forbiddenContexts.includes(context)) {
    throw new Error(`The context ${context} includes a reserved keyword and is not allowed`)
  }
  return context.replace(/^branch:/, '')
}

/**
 * Finds a matching environment variable value for a given context
 * @private
 */
export const getValueForContext = (
  /**
   * An array of environment variable values from Envelope
   */
  values: EnvelopeEnvVarValue[],
  /**
   * The deploy context or branch of the environment variable value
   */
  contextOrBranch: ContextOrBranch,
): EnvelopeEnvVarValue | undefined => {
  const isSupportedContext = (SUPPORTED_CONTEXTS as readonly string[]).includes(contextOrBranch)
  if (!isSupportedContext) {
    const valueMatchingAsBranch = values.find((val) => val.context_parameter === contextOrBranch)
    // This is a `branch` context, which is an override, so it takes precedence
    if (valueMatchingAsBranch != null) {
      return valueMatchingAsBranch
    }
    const valueMatchingContext = values.find((val) => val.context === 'all' || val.context === 'branch-deploy')
    return valueMatchingContext ?? undefined
  }
  const valueMatchingAsContext = values.find((val) => val.context === 'all' || val.context === contextOrBranch)
  return valueMatchingAsContext ?? undefined
}

/**
 * Finds environment variables that match a given source
 * @param env - The dictionary of environment variables
 * @param source - The source of the environment variable
 * @returns The dictionary of env vars that match the given source
 */
export const filterEnvBySource = (
  env: Record<string, EnvironmentVariable>,
  source: EnvironmentVariableSource,
): typeof env => Object.fromEntries(Object.entries(env).filter(([, variable]) => variable.sources[0] === source))

const fetchEnvelopeItems = async function ({
  accountId,
  api,
  key,
  siteId,
}: {
  accountId: string
  api: NetlifyAPI
  key: string
  siteId?: string | undefined
}): Promise<EnvelopeItem[]> {
  if (accountId === undefined) {
    return []
  }
  try {
    // if a single key is passed, fetch that single env var
    if (key) {
      const envelopeItem = await api.getEnvVar({ accountId, key, siteId })
      // See FIXME(serhalp) above
      return [envelopeItem as EnvelopeItem]
    }
    // otherwise, fetch the entire list of env vars
    const envelopeItems = await api.getEnvVars({ accountId, siteId })
    // See FIXME(serhalp) above
    return envelopeItems as EnvelopeItem[]
  } catch {
    // Collaborators aren't allowed to read shared env vars,
    // so return an empty array silently in that case
    return []
  }
}

/**
 * Filters and sorts data from Envelope by a given context and/or scope
 * @param context - The deploy context or branch of the environment variable value
 * @param envelopeItems - An array of environment variables from the Envelope service
 * @param scope - The scope of the environment variables
 * @param source - The source of the environment variable
 * @returns A dicionary in the following format:
 * {
 *   FOO: {
 *     context: 'dev',
 *     scopes: ['builds', 'functions'],
 *     sources: ['ui'],
 *     value: 'bar',
 *   },
 *   BAZ: {
 *     context: 'branch',
 *     branch: 'staging',
 *     scopes: ['runtime'],
 *     sources: ['account'],
 *     value: 'bang',
 *   },
 * }
 */
export const formatEnvelopeData = ({
  context = 'dev',
  envelopeItems = [],
  scope = 'any',
  source,
}: {
  context?: ContextOrBranch
  envelopeItems: EnvelopeItem[]
  scope?: SupportedScope
  source: string
}): Record<
  string,
  {
    context: ContextOrBranch
    branch: string | undefined
    scopes: string[]
    sources: string[]
    value: string
  }
> =>
  envelopeItems
    // filter by context
    .filter(({ values }) => Boolean(getValueForContext(values, context)))
    // filter by scope
    .filter(({ scopes }) => (scope === 'any' ? true : scopes.includes(scope)))
    // sort alphabetically, case insensitive
    .sort((left, right) => (left.key.toLowerCase() < right.key.toLowerCase() ? -1 : 1))
    // format the data
    .reduce((acc, cur) => {
      const val = getValueForContext(cur.values, context)
      if (val === undefined) {
        throw new TypeError(`failed to locate environment variable value for ${context} context`)
      }
      const { context: itemContext, context_parameter: branch, value } = val
      return {
        ...acc,
        [cur.key]: {
          context: itemContext,
          branch,
          scopes: cur.scopes,
          sources: [source],
          value,
        },
      }
    }, {})

/**
 * Collects env vars from multiple sources and arranges them in the correct order of precedence
 *
 * @returns An object of environment variables keys and their metadata
 */
const getEnvelopeEnv = async ({
  accountId,
  api,
  context = 'dev',
  env,
  key = '',
  raw = false,
  scope = 'any',
  siteId,
}: {
  accountId: string
  api: NetlifyAPI
  context?: ContextOrBranch | undefined
  env: Record<string, EnvironmentVariable>
  key?: string | undefined
  raw?: boolean | undefined
  scope?: SupportedScope | undefined
  siteId: string
}) => {
  const [accountEnvelopeItems, siteEnvelopeItems] = await Promise.all([
    fetchEnvelopeItems({ api, accountId, key }),
    fetchEnvelopeItems({ api, accountId, key, siteId }),
  ])

  const accountEnv = formatEnvelopeData({ context, envelopeItems: accountEnvelopeItems, scope, source: 'account' })
  const siteEnv = formatEnvelopeData({ context, envelopeItems: siteEnvelopeItems, scope, source: 'ui' })

  if (raw) {
    const entries = Object.entries({ ...accountEnv, ...siteEnv })
    return entries.reduce(
      (obj, [envVarKey, metadata]) => ({
        ...obj,
        [envVarKey]: metadata.value,
      }),
      {},
    )
  }

  const generalEnv = filterEnvBySource(env, 'general')
  const internalEnv = filterEnvBySource(env, 'internal')
  const addonsEnv = filterEnvBySource(env, 'addons')
  const configFileEnv = filterEnvBySource(env, 'configFile')

  // filter out configFile env vars if a non-configFile scope is passed
  const includeConfigEnvVars = /any|builds|post[-_]processing/.test(scope)

  // Sources of environment variables, in ascending order of precedence.
  return {
    ...generalEnv,
    ...accountEnv,
    ...(includeConfigEnvVars ? addonsEnv : {}),
    ...siteEnv,
    ...(includeConfigEnvVars ? configFileEnv : {}),
    ...internalEnv,
  }
}

/**
 * Returns a human-readable, comma-separated list of scopes
 * @param scopes An array of scopes
 * @returns A human-readable, comma-separated list of scopes
 */
export const getHumanReadableScopes = (scopes?: EnvelopeEnvVarScope[]): string => {
  const HUMAN_SCOPES = ['Builds', 'Functions', 'Runtime', 'Post processing']
  const SCOPES_MAP = {
    builds: HUMAN_SCOPES[0],
    functions: HUMAN_SCOPES[1],
    runtime: HUMAN_SCOPES[2],
    post_processing: HUMAN_SCOPES[3],
    // TODO(serhalp) I believe this isn't needed, as `post-processing` is a user-provided
    // CLI option, not a scope returned by the Envelope API.
    'post-processing': HUMAN_SCOPES[3],
  }
  if (!scopes) {
    // if `scopes` is not available, the env var comes from netlify.toml
    // env vars specified in netlify.toml are present in the `builds` and `post_processing` scope
    return 'Builds, Post processing'
  }
  if (scopes.length === Object.keys(HUMAN_SCOPES).length) {
    // shorthand instead of listing every available scope
    return 'All'
  }
  return scopes.map((scope) => SCOPES_MAP[scope]).join(', ')
}
