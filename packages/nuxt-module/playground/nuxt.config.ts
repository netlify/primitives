export default defineNuxtConfig({
  modules: ['../src/module'],
  telemetry: { enabled: false },
  compatibilityDate: '2025-07-11',
  future: {
    compatibilityVersion: 4,
  },
  netlify: {
    // Just verifies module option types work
    blobs: {
      enabled: true,
    },
  },
  devtools: { enabled: true },
})
