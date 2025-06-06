import type { Context } from '@netlify/types'

export type EdgeFunction = (
  request: Request,
  context: Context,
) => Response | Promise<Response> | URL | Promise<URL> | undefined | Promise<void>
