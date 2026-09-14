// A framework-style entry: no listener, just a default export with a `fetch`
// method, which the bootstrap hosts behind its own server.
export default {
  fetch: (request) =>
    Response.json({
      form: 'fetch',
      pid: process.pid,
      url: new URL(request.url).pathname,
    }),
}
