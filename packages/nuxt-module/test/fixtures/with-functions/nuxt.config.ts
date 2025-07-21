import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [MyModule],
  telemetry: { enabled: false },
  compatibilityDate: '2025-07-11',
})
