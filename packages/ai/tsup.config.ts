import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/main.ts', 'src/bootstrap/main.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  tsconfig: 'tsconfig.json',
})
