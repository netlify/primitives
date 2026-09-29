import { createServer } from 'node:http'

interface Payload {
  pid: number
  typescript: boolean
  url: string
}

createServer((req, res) => {
  const payload: Payload = {
    pid: process.pid,
    typescript: true,
    url: req.url ?? '',
  }

  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}).listen(process.env.PORT)
