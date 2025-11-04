import { argv } from 'node:process'

import { defineConfig } from 'tsup'

export default defineConfig([
  {
    clean: true,
    entry: ['src/main.ts'],
    outDir: 'dist',
    // We build both CJS and ESM because @netlify/blobs is dual-format and depends on this package.
    // When @netlify/blobs becomes ESM-only, we can remove CJS here and go ESM-only too.
    // See: https://github.com/netlify/primitives/issues/437
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    watch: argv.includes('--watch'),
    platform: 'node',
    bundle: true,
  },
])
