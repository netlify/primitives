import MyModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [MyModule],
  compatibilityDate: '2025-07-11',
  future: {
    compatibilityVersion: 4,
  },
})
