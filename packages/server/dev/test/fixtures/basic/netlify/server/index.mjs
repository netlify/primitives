import { createServer } from 'node:http'

// Captured at module scope: proves the child process environment is in place
// before the entry is imported.
const capturedAtImport = process.env.SERVER_DEV_TEST_VAR ?? 'MISSING'

createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(
    JSON.stringify({
      capturedAtImport,
      clientIP: req.headers['x-nf-client-connection-ip'] ?? null,
      geo: req.headers['x-nf-geo'] ?? null,
      pid: process.pid,
      siteID: req.headers['x-nf-site-id'] ?? null,
      url: req.url,
    }),
  )
}).listen(process.env.PORT)
