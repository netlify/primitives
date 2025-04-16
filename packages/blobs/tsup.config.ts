import { argv } from 'node:process'

import { defineConfig } from 'tsup'

export default defineConfig([
  {
    clean: true,
    entry: ['src/server.ts', 'src/main.ts'],
    tsconfig: 'tsconfig.json',
    bundle: true,
    format: ['cjs', 'esm'],
    dts: true,
    outDir: './dist',
    watch: argv.includes('--watch'),
  },
])
