import { createServer } from 'node:http'

import { WebSocketServer } from 'ws'

const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('http')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  ws.on('error', () => {})
  ws.on('message', (message) => {
    ws.send(`echo:${message}`)
  })
})

server.listen(process.env.PORT)
