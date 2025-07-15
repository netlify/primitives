import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [MyModule],
  telemetry: { enabled: false },
})
