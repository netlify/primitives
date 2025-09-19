import { exec as originalExec } from 'node:child_process'
import { writeFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { URL } from 'node:url'
import { promisify } from 'node:util'

import normalizePackageData, { type Package } from 'normalize-package-data'

const exec = promisify(originalExec)

// https://app.netlify.com/sites/tanstack-start-e2e-tests
const SITE_ID = process.env.NETLIFY_SITE_ID ?? 'cd4e45ce-895c-432b-af6d-61e10ad1d125'

export interface Deploy {
  deployId: string
  url: string
  logs: string
}

const packages = [
  { name: '@netlify/vite-plugin', dirName: 'vite-plugin' },
  { name: '@netlify/vite-plugin-tanstack-start', dirName: 'vite-plugin-tanstack-start' },
]

/**
 * Inject the current revision of this repo's packages into the fixture.
 *
 * We can't use a simpler approach like a monorepo workspace or `npm link` because the fixture site
 * needs to be self-contained to be deployable to Netlify (i.e. it can't have symlinks).
 */
const prepareDeps = async (cwd: string, packagesAbsoluteDir: string): Promise<void> => {
  const packageJson = JSON.parse(await readFile(`${cwd}/package.json`, 'utf-8')) as Package & {
    overrides?: Record<string, string>
  }
  normalizePackageData(packageJson)
  packageJson.overrides ??= {}
  const { dependencies = {}, devDependencies = {} } = packageJson
  for (const pkg of packages) {
    const isDep = pkg.name in dependencies
    const isDevDep = pkg.name in devDependencies
    console.log(`📦 Injecting ${pkg.name} ${isDevDep ? 'dev ' : ''}dependency`)
    const { stdout } = await exec(`npm pack --json --ignore-scripts --pack-destination ${cwd}`, {
      cwd: join(packagesAbsoluteDir, pkg.dirName),
    })
    const [{ filename }] = JSON.parse(stdout) as { filename: string }[]
    if (isDep) {
      dependencies[pkg.name] = `file:${filename}`
    }
    if (isDevDep) {
      devDependencies[pkg.name] = `file:${filename}`
    }
    // Ensure that even a transitive dependency on this package is overridden.
    packageJson.overrides[pkg.name] = `file:${filename}`
  }
  await writeFile(`${cwd}/package.json`, JSON.stringify(packageJson, null, 2))
  await exec('npm install --no-package-lock', { cwd })
}

export const deploySite = async (projectDir: string): Promise<Deploy> => {
  await prepareDeps(projectDir, join(import.meta.dirname, '../../../'))

  console.log(`🚀 Building and deploying site...`)
  try {
    // Ideally `netlify-cli` should be installed as a dev dep, but since it in turn
    // depends on some packages in this monorepo, this runs into some issues (despite no actual
    // circular dependencies). This should be easy to avoid but npm's workspaces feature is
    // too basic.
    const cmd = `npx -y netlify deploy --json --site ${SITE_ID}`
    const { stdout, stderr } = await exec(cmd, { cwd: projectDir })
    await writeFile(join(projectDir, '__deploy.stdout.log'), stdout, { encoding: 'utf-8' })
    await writeFile(join(projectDir, '__deploy.stderr.log'), stderr, { encoding: 'utf-8' })
    // NOTE: `--json` is needed because otherwise the pretty box may wrap the URL over 2+ lines
    const [url] = new RegExp(/https:.+\.netlify\.app/gm).exec(stdout) ?? []
    if (!url) {
      throw new Error('Could not extract the URL from the build logs')
    }
    console.log(`🌍 Deployed site is live: ${url}`)
    const [deployId] = new URL(url).host.split('--')
    return { url, deployId, logs: `${stdout}\n${stderr}` }
  } catch (err) {
    console.error('❌ Deployment failed:', err)
    throw err
  }
}
