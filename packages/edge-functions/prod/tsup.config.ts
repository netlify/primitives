import { argv } from 'node:process'

import { defineConfig } from 'tsup'

export default defineConfig([
  {
    clean: true,
    format: ['esm'],
    entry: ['src/main.ts'],
    tsconfig: 'tsconfig.json',
    splitting: false,
    bundle: true,
    dts: true,
    outDir: './dist',
    watch: argv.includes('--watch'),
  },
])
