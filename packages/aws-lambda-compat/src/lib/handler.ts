import type { HandlerContext } from './handler_context.js'
import type { HandlerEvent } from './handler_event.js'
import type { HandlerResponse } from './handler_response.js'

export type HandlerCallback<ResponseType extends HandlerResponse = HandlerResponse> = (
  error: unknown,
  response: ResponseType,
) => void

export type Handler = (
  event: HandlerEvent,
  context: HandlerContext,
  callback?: HandlerCallback,
) => undefined | Promise<HandlerResponse>
