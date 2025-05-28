import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageJsonPath = path.resolve(fileURLToPath(import.meta.url), '../../package.json')

/**
 * Returns the URL of the edge functions bootstrap entry file.
 *
 * @returns {Promise<string>}
 */
export const getURL = async () => {
  try {
    const data = await fs.readFile(packageJsonPath, 'utf8')
    const { version } = JSON.parse(data)

    // Releasing version 1.2.3 of the `@netlify/edge-functions` module will
    // make release-please create a GitHub release and corresponding tag of
    // `v1.2.3`. Because the `edge` Netlify site is configured to build all
    // branches, the tag will generate a `v1-2-3--edge.netlify.com` URL,
    // which serves the bootstrap for this version. We're computing that
    // URL here.
    const branch = `v${version.split('.').join('-')}`

    return `https://${branch}--edge.netlify.com/bootstrap/index-combined.ts`
  } catch (error) {
    throw new Error(`Could not find edge bootstrap version: ${error}`)
  }
}
