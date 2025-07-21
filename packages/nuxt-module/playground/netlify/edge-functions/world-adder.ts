import type { Context } from '@netlify/edge-functions'

export default async function handler(_req: Request, context: Context) {
  const res = await context.next()
  const body = await res.text()
  return new Response(`${body} world`)
}

export const config = {
  path: '/hello',
}
