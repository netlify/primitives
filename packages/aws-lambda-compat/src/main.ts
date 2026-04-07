import type { Context } from '@netlify/types'

import type { HandlerContext } from './lib/handler_context.js'
import type { HandlerEvent } from './lib/handler_event.js'
import type { HandlerResponse } from './lib/handler_response.js'
import { buildEventFromRequest, buildLambdaContext } from './lib/request_to_event.js'
import { buildResponseFromResult } from './lib/response_from_handler.js'

type LambdaHandler = (event: HandlerEvent, context: HandlerContext) => Promise<HandlerResponse> | HandlerResponse

export function withLambda(handler: LambdaHandler) {
  return async (request: Request, context: Context): Promise<Response> => {
    const event = await buildEventFromRequest(request)
    const lambdaContext = buildLambdaContext(context)
    const result = await handler(event, lambdaContext)

    return buildResponseFromResult(result)
  }
}

export type { LambdaHandler }
export type { Handler, HandlerCallback } from './lib/handler.js'
export type { HandlerContext } from './lib/handler_context.js'
export type { HandlerEvent } from './lib/handler_event.js'
export type { HandlerResponse } from './lib/handler_response.js'
