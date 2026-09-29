import { createServer } from 'node:http'

// A framework server that starts its own listener and claims only some paths.
createServer((req, res) => {
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ url: req.url }))
}).listen(process.env.PORT)

export const config = { path: ['/api/*', '/Health'] }
