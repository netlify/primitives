import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    clean: true,
    format: ['cjs', 'esm'],
    entry: ['src/bootstrap/main.ts', 'src/main.ts'],
    tsconfig: 'tsconfig.json',
    dts: true,
    outDir: './dist',
  },
])
