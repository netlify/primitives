import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { sep as posixSep } from 'node:path/posix'

import js from 'dedent'
import type { Plugin, ResolvedConfig } from 'vite'

import { version, name } from '../package.json'

// https://docs.netlify.com/frameworks-api/#netlify-v1-functions
const NETLIFY_FUNCTIONS_DIR = '.netlify/v1/functions'

const FUNCTION_FILENAME = 'server.mjs'

const toPosixPath = (path: string) => path.split(sep).join(posixSep)

// Generate the Netlify function that imports the built entrypoint
const createNetlifyFunctionHandler = (handlerPath: string) => js`
import entry from "${handlerPath}";

if (typeof entry?.fetch !== "function") {
  console.error("The server entrypoint must follow the semi-standard export { fetch: (req: Request) => Promise<Response> } format");
}

export default entry.fetch;

export const config = {
  name: "@netlify/vite-plugin server handler",
  generator: "${name}@${version}",
  path: "/*",
  preferStatic: true,
};
`

export function createBuildPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig

  return {
    name: 'vite-plugin-netlify:build',
    apply: 'build',

    applyToEnvironment(environment) {
      // Apply this to any and all environments that build for the server. Generally this is just 'ssr', but
      // users, metaframeworks, and other plugins may have others, such as `rsc`.
      // TODO(serhalp): This isn't actually fully implemented. We'd need to hold on to all the `originalEntrypoint`s,
      // repeat the `writeBundle` step for each one, and thread routing information through to the function config.
      return environment.config.consumer === 'server'
    },

    configResolved(config) {
      resolvedConfig = config
    },

    // See https://rollupjs.org/plugin-development/#writebundle.
    async writeBundle(_, bundle) {
      // Find the built entrypoint file in the bundle
      const entryChunk = Object.values(bundle).find((chunk) => chunk.type === 'chunk' && chunk.isEntry)

      if (!entryChunk) {
        console.warn('Could not find entry chunk in bundle - aborting!')
        return
      }

      // Write the Netlify function that imports the built entrypoint
      const functionsDirectory = join(resolvedConfig.root, NETLIFY_FUNCTIONS_DIR)
      await mkdir(functionsDirectory, { recursive: true })
      const handlerPath = join(resolvedConfig.build.outDir, entryChunk.fileName)
      const relativeHandlerPath = toPosixPath(relative(functionsDirectory, handlerPath))
      await writeFile(join(functionsDirectory, FUNCTION_FILENAME), createNetlifyFunctionHandler(relativeHandlerPath))
    },
  }
}
