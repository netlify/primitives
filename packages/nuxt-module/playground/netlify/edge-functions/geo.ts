import type { Context } from '@netlify/edge-functions'

export default async function handler(_req: Request, context: Context) {
  const { geo } = context
  const res = await context.next()
  res.headers.set('x-country', geo.country?.code ?? 'unknown')
  return res
}

export const config = {
  path: '/*',
}
