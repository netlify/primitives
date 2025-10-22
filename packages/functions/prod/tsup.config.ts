import { argv } from 'node:process'

import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  entry: ['src/main.ts', 'src/internal.ts'],
  outDir: 'dist',
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  watch: argv.includes('--watch'),
  platform: 'node',
  bundle: true,
})
