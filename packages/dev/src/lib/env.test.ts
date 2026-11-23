import { Fixture } from '@netlify/test-utils'
import { describe, expect, test, vi } from 'vitest'

import { applyDotEnvFiles, loadDotEnvFiles, type DotEnvFile, type EnvironmentVariable } from './env.js'

const getLogger = () => ({ error: vi.fn(), log: vi.fn(), warn: vi.fn() })

describe('loadDotEnvFiles', () => {
  test('reads the default files that exist, highest precedence first', async () => {
    const fixture = new Fixture()
      .withFile('.env', 'FROM=env\nONLY_IN_ENV=1')
      .withFile('.env.local', 'FROM=env.local')
      .withFile('.env.production', 'FROM=env.production')
    const directory = await fixture.create()
    const logger = getLogger()

    const files = await loadDotEnvFiles({ logger, projectRoot: directory })

    expect(files).toStrictEqual([
      { env: { FROM: 'env.local' }, file: '.env.local' },
      { env: { FROM: 'env', ONLY_IN_ENV: '1' }, file: '.env' },
    ])
    expect(logger.warn).not.toHaveBeenCalled()

    await fixture.destroy()
  })

  test('reads only the files in `envFiles`, in that order', async () => {
    const fixture = new Fixture().withFile('.env', 'FROM=env').withFile('.env.production', 'FROM=env.production')
    const directory = await fixture.create()

    const files = await loadDotEnvFiles({
      envFiles: ['.env.production', '.env.missing'],
      logger: getLogger(),
      projectRoot: directory,
    })

    expect(files).toStrictEqual([{ env: { FROM: 'env.production' }, file: '.env.production' }])

    await fixture.destroy()
  })
})

describe('applyDotEnvFiles', () => {
  const dotEnvFiles: DotEnvFile[] = [
    { env: { SHARED: 'from .env.local' }, file: '.env.local' },
    { env: { FROM_CONFIG: 'from .env', INTERNAL: 'from .env', SHARED: 'from .env' }, file: '.env' },
  ]

  test('gives the first file precedence over the files after it', () => {
    expect(applyDotEnvFiles({}, dotEnvFiles).SHARED).toStrictEqual({
      sources: ['.env.local file', '.env file'],
      value: 'from .env.local',
    })
  })

  test('takes precedence over other sources but not over internal variables', () => {
    const variables: Record<string, EnvironmentVariable> = {
      FROM_CONFIG: { sources: ['configFile'], value: 'from netlify.toml' },
      INTERNAL: { sources: ['internal'], value: 'internal value' },
    }

    const result = applyDotEnvFiles(variables, dotEnvFiles)

    expect(result.FROM_CONFIG).toStrictEqual({ sources: ['.env file', 'configFile'], value: 'from .env' })
    expect(result.INTERNAL).toStrictEqual({ sources: ['internal'], value: 'internal value' })
    expect(variables.FROM_CONFIG.value).toBe('from netlify.toml')
  })
})
