// @ts-check

/**
 * @param {unknown} error
 */
export const getErrorResponse = (error) => {
  const errorData =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: String(error.cause),
        }
      : String(error)

  return Response.json(
    {
      error: errorData,
    },
    {
      headers: {
        'x-nf-uncaught-error': '1',
      },
      status: 500,
    },
  )
}
