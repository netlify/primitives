import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import js from 'dedent'
import type { Plugin, Rollup } from 'vite'

import { createBuildPlugin } from './build.js'

// Create a Remix/RR7 server entry point that follows the conventional Fetchable interface.
// There's no way around this, as Remix/RR7 does not emit a server entry point at all.
const getFrameworkServerEntrypointCode = (framework: 'remix' | 'react-router', remixServerBuildPath: string) => js`
import { createRequestHandler } from "${framework}";
import * as build from "${remixServerBuildPath}";

const handler = createRequestHandler(build, "production");

export default {
  fetch: async (request) => {
    return handler(request, Netlify.context);
  }
};
`
const REMIX_SERVER_ENTRYPOINT_FILENAME = 'remix-server.mjs'
/**
 * Creates a build plugin for Remix/React Router 7 that generates a Netlify-compatible
 * server handler using React Router's createRequestHandler.
 */
export function createRemixBuildPlugin(framework: 'remix' | 'react-router'): Plugin[] {
  let outDir: string
  let remixServerEntrypointPath!: string

  const getServerEntrypoint = (bundle: Rollup.OutputBundle): string => {
    // Find the built server bundle entry. Remix/RR7 does not emit a server entry point at all.
    // Instead its bundle entry is this object:
    // https://github.com/remix-run/react-router/blob/c1cdded/packages/react-router/lib/server-runtime/build.ts#L21.
    const entryChunk = Object.values(bundle).find(
      (chunk): chunk is Rollup.OutputChunk => chunk.type === 'chunk' && chunk.isEntry,
    )
    if (!entryChunk) {
      throw new Error('Could not find entry chunk in bundle - aborting!')
    }
    return join(outDir, entryChunk.fileName)
  }

  const remixBuildPlugin: Plugin = {
    name: 'vite-plugin-netlify:remix-virtual',
    apply: 'build',
    applyToEnvironment({ name }) {
      return name === 'ssr'
    },
    configResolved(config) {
      outDir = config.build.outDir
      remixServerEntrypointPath = join(outDir, REMIX_SERVER_ENTRYPOINT_FILENAME)
    },
    async writeBundle(_, bundle) {
      // "Patch" this framework's server build output by generating a server entry point
      await writeFile(
        remixServerEntrypointPath,
        getFrameworkServerEntrypointCode(framework, getServerEntrypoint(bundle)),
      )
    },
  }

  const buildPlugin = createBuildPlugin({
    getServerEntrypoint: () => remixServerEntrypointPath,
  })

  return [remixBuildPlugin, buildPlugin]
}
