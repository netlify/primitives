import path from 'node:path'
import process from 'node:process'

import { resolveConfig } from '@netlify/config'
import { getAPIToken, LocalState } from '@netlify/dev-utils'
// import { createRewriter } from '@netlify/redirects'

// import { NetlifyAPI } from 'netlify'

import { isFile } from './fs.js'

type Config = Awaited<ReturnType<typeof resolveConfig>>

interface GetConfigOptions {
  projectRoot: string
}

export const getConfig = async ({
  projectRoot,
}: GetConfigOptions): Promise<{ config: Config; siteID?: string } | undefined> => {
  const token = await getAPIToken()
  const state = new LocalState(projectRoot)
  const siteID = state.get('siteId')
  const configFilePath = path.resolve(projectRoot, 'netlify.toml')
  const configFileExists = await isFile(configFilePath)
  const config = await resolveConfig({
    config: configFileExists ? configFilePath : undefined,
    repositoryRoot: projectRoot,
    cwd: process.cwd(),
    context: 'dev',
    siteId: siteID,
    token,
    mode: 'cli',
    offline: !siteID,
  })

  return { config, siteID }
}
