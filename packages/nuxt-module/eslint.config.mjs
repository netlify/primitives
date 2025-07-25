// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

// Run `npx @eslint/config-inspector` to inspect the resolved config interactively
export default createConfigForNuxt({
  features: {
    // Rules for module authors
    tooling: true,
    // We configure and run formatting at the monorepo level
    stylistic: false,
  },
  dirs: {
    src: ['./playground'],
  },
})
  .append
  // your custom flat config here...
  ()
