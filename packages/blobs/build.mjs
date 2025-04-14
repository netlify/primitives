#!/usr/bin/env node
import { rm } from 'node:fs/promises'
import { argv } from 'process'

import { build } from 'tsup'

const dist = './dist'

await rm(dist, { recursive: true, force: true })

/** @type {import('tsup').Options} */
const options = {
  entry: ['src/server.ts', 'src/main.ts'],
  tsconfig: 'tsconfig.json',
  bundle: true,
  dts: true,
  outDir: dist,
  watch: argv.includes('--watch'),
}

await Promise.all(['esm', 'cjs'].map((format) => build({ ...options, format })))
