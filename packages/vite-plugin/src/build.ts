import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { sep as posixSep } from 'node:path/posix'

import js from 'dedent'
import type { Plugin, ResolvedConfig } from 'vite'

import { version, name } from '../package.json'

// https://docs.netlify.com/frameworks-api/#netlify-v1-functions
const NETLIFY_FUNCTIONS_DIR = '.netlify/v1/functions'

const FUNCTION_FILENAME = 'server.mjs'
/**
 * The chunk name, i.e. in the Rollup config `input` format
 */
const FUNCTION_HANDLER_CHUNK = 'server'

const FUNCTION_HANDLER_MODULE_ID = 'virtual:netlify-server'
// See https://vitejs.dev/guide/api-plugin#virtual-modules-convention.
const RESOLVED_FUNCTION_HANDLER_MODULE_ID = `\0${FUNCTION_HANDLER_MODULE_ID}`

const toPosixPath = (path: string) => path.split(sep).join(posixSep)

// The virtual module that is the compiled Vite SSR entrypoint (a Netlify Function handler)
const createNetlifyFunctionHandler = (originalEntrypoint: string) => js`
import entry from "${originalEntrypoint}";

if (typeof entry?.fetch !== "function") {
  console.error("The server entrypoint must follow the semi-standard export { fetch: (req: Request) => Promise<Response> } format");
}
export default entry.fetch;
`

// This is written to the Netlify functions directory. It just re-exports the compiled entrypoint, along with Netlify
// function config.
const generateNetlifyFunction = (handlerPath: string) => {
  return js`
    export { default } from "${handlerPath}";

    export const config = {
      name: "@netlify/vite-plugin server handler",
      generator: "${name}@${version}",
      path: "/*",
      preferStatic: true,
    };
    `
}

export function createBuildPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig
  let originalEntrypoint: string | undefined

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

    configEnvironment(name, { build }) {
      if (typeof build?.rollupOptions?.input !== 'string') {
        console.warn(
          `Expected build.rollupOptions.input for environment '${name}' to be a string, but it is an unsupported type - aborting!`,
        )
        return
      }

      // Replace this server entrypoint with our own, which will import and defer to this one, and which is in turn
      // imported by our Netlify function handler via a virtual module)
      originalEntrypoint = build.rollupOptions.input
      build.rollupOptions.input = {
        [FUNCTION_HANDLER_CHUNK]: FUNCTION_HANDLER_MODULE_ID,
      }
      build.rollupOptions.output ??= {}
      if (Array.isArray(build.rollupOptions.output)) {
        console.warn(
          `Expected rollupOptions.output for environment '${name}' to be an object, but it is an array - overwriting it, but this may cause issues with your custom configuration`,
        )
        build.rollupOptions.output = {}
      }
      build.rollupOptions.output.entryFileNames = '[name].js'
    },

    configResolved(config) {
      resolvedConfig = config
    },

    // See https://vitejs.dev/guide/api-plugin#virtual-modules-convention.
    resolveId(source) {
      if (source === FUNCTION_HANDLER_MODULE_ID) {
        return RESOLVED_FUNCTION_HANDLER_MODULE_ID
      }
    },
    load(id) {
      if (id === RESOLVED_FUNCTION_HANDLER_MODULE_ID) {
        if (typeof originalEntrypoint !== 'string') {
          console.warn('Unable to resolve original server entrypoint - aborting!')
          return
        }
        return createNetlifyFunctionHandler(originalEntrypoint)
      }
    },

    // See https://rollupjs.org/plugin-development/#writebundle.
    async writeBundle() {
      // Write the server entrypoint to the Netlify functions directory
      const functionsDirectory = join(resolvedConfig.root, NETLIFY_FUNCTIONS_DIR)
      await mkdir(functionsDirectory, { recursive: true })
      const handlerPath = join(resolvedConfig.build.outDir, `${FUNCTION_HANDLER_CHUNK}.js`)
      const relativeHandlerPath = toPosixPath(relative(functionsDirectory, handlerPath))
      await writeFile(join(functionsDirectory, FUNCTION_FILENAME), generateNetlifyFunction(relativeHandlerPath))
    },
  }
}
