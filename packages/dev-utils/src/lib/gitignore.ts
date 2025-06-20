import { readFile, stat, writeFile } from 'fs/promises'
import path from 'path'

import parseIgnore from 'parse-gitignore'

import type { Logger } from './logger.js'

const hasGitIgnore = async function (dir: string) {
  const gitIgnorePath = path.join(dir, '.gitignore')

  try {
    const ignoreStats = await stat(gitIgnorePath)

    return ignoreStats.isFile()
  } catch {
    return false
  }
}

export const ensureNetlifyIgnore = async (dir: string, logger?: Logger) => {
  const gitIgnorePath = path.join(dir, '.gitignore')
  const ignoreContent = '# Local Netlify folder\n.netlify\n'

  /* No .gitignore file. Create one and ignore .netlify folder */
  if (!(await hasGitIgnore(dir))) {
    await writeFile(gitIgnorePath, ignoreContent, 'utf8')
    return false
  }

  let gitIgnoreContents
  let ignorePatterns
  try {
    gitIgnoreContents = await readFile(gitIgnorePath, 'utf8')
    ignorePatterns = parseIgnore.parse(gitIgnoreContents)
  } catch {
    // ignore
  }
  /* Not ignoring .netlify folder. Add to .gitignore */
  if (!ignorePatterns?.patterns.some((pattern) => /(^|\/|\\)\.netlify($|\/|\\)/.test(pattern))) {
    logger?.log()
    logger?.log('Adding local .netlify folder to .gitignore file...')
    const newContents = `${gitIgnoreContents}\n${ignoreContent}`
    await writeFile(gitIgnorePath, newContents, 'utf8')
  }
}
