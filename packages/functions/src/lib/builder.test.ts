import { expect, test } from 'vitest'

import { builder } from './builder.js'
import {invokeLambda} from "../../test/helpers/main.mjs"
import { HandlerEvent } from '../main.js'
import { BaseHandler } from '../function/handler.js'

const METADATA_OBJECT = { metadata: { version: 1, builder_function: true, ttl: 0 } }

test('Injects the metadata object into an asynchronous handler', async (t) => {
  const originalResponse = {
    body: ':thumbsup:',
    statusCode: 200,
    ttl: 3600,
  }
  const myHandler = async () => {
    const asyncTask = new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    await asyncTask

    return originalResponse
  }
  const response = await invokeLambda(builder(myHandler))

  expect(response).toStrictEqual({ ...originalResponse, metadata: { version: 1, builder_function: true, ttl: 3600 } })
})

test('Injects the metadata object into a synchronous handler', async (t) => {
  const originalResponse = {
    body: ':thumbsup:',
    statusCode: 200,
  }
  const myHandler: BaseHandler = (event, context, callback) => {
    callback?.(null, originalResponse)
  }
  const response = await invokeLambda(builder(myHandler))

  expect(response).toStrictEqual({ ...originalResponse, ...METADATA_OBJECT })
})

test('Injects the metadata object for non-200 responses', async (t) => {
  const originalResponse = {
    body: ':thumbsdown:',
    statusCode: 404,
  }
  const myHandler = async () => {
    const asyncTask = new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    await asyncTask

    return originalResponse
  }
  const response = await invokeLambda(builder(myHandler))

  expect(response).toStrictEqual({ ...originalResponse, ...METADATA_OBJECT })
})

test('Returns a 405 error for requests using the POST method', async (t) => {
  const originalResponse = {
    body: ':thumbsup:',
    statusCode: 200,
  }
  const myHandler = async () => {
    const asyncTask = new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    await asyncTask

    return originalResponse
  }
  const response = await invokeLambda(builder(myHandler), { method: 'POST' })

  expect(response).toStrictEqual({ body: 'Method Not Allowed', statusCode: 405 })
})

test('Returns a 405 error for requests using the PUT method', async (t) => {
  const originalResponse = {
    body: ':thumbsup:',
    statusCode: 200,
  }
  const myHandler = async () => {
    const asyncTask = new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    await asyncTask

    return originalResponse
  }
  const response = await invokeLambda(builder(myHandler), { method: 'PUT' })

  expect(response).toStrictEqual({ body: 'Method Not Allowed', statusCode: 405 })
})

test('Returns a 405 error for requests using the DELETE method', async (t) => {
  const originalResponse = {
    body: ':thumbsup:',
    statusCode: 200,
  }
  const myHandler = async () => {
    const asyncTask = new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    await asyncTask

    return originalResponse
  }
  const response = await invokeLambda(builder(myHandler), { method: 'DELETE' })

  expect(response).toStrictEqual({ body: 'Method Not Allowed', statusCode: 405 })
})

test('Returns a 405 error for requests using the PATCH method', async (t) => {
  const originalResponse = {
    body: ':thumbsup:',
    statusCode: 200,
  }
  const myHandler = async () => {
    const asyncTask = new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    await asyncTask

    return originalResponse
  }
  const response = await invokeLambda(builder(myHandler), { method: 'PATCH' })

  expect(response).toStrictEqual({ body: 'Method Not Allowed', statusCode: 405 })
})

test('Preserves errors thrown inside the wrapped handler', async () => {
  const error = new Error('Uh-oh!')

  // @ts-expect-error
  error.someProperty = ':thumbsdown:'

  const myHandler = async () => {
    const asyncTask = new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    await asyncTask

    throw error
  }

  try {
    await invokeLambda(builder(myHandler))

    throw new Error("Invocation should have failed")
  } catch {}
})

test('Does not pass query parameters to the wrapped handler', async (t) => {
  const originalResponse = {
    body: ':thumbsup:',
    statusCode: 200,
  }
  // eslint-disable-next-line require-await
  const myHandler = async (event: HandlerEvent) => {
    expect(event.multiValueQueryStringParameters).toStrictEqual({})
    expect(event.queryStringParameters).toStrictEqual({})

    return originalResponse
  }
  const multiValueQueryStringParameters = { foo: ['bar'], bar: ['baz'] }
  const queryStringParameters = { foo: 'bar', bar: 'baz' }
  const response = await invokeLambda(builder(myHandler), {
    // @ts-expect-error TODO: Fic types.
    multiValueQueryStringParameters,
    queryStringParameters,
  })

  expect(response).toStrictEqual({ ...originalResponse, ...METADATA_OBJECT })
})
