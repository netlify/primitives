export const SSL_REQUEST_CODE = 80877103
export const PROTOCOL_VERSION_3_0 = 196608
export const SSL_RESPONSE_NO = Buffer.from([0x4e])

/**
 * Builds the AuthenticationOk + ReadyForQuery messages to send to a client
 * after successful authentication.
 *
 * AuthenticationOk: 'R' + int32(8) + int32(0)
 * ReadyForQuery:    'Z' + int32(5) + byte('I')
 */
export function buildAuthOkAndReady(): Buffer {
  // AuthenticationOk message
  const authOk = Buffer.alloc(9)
  authOk.writeUInt8(0x52, 0) // 'R'
  authOk.writeInt32BE(8, 1) // length
  authOk.writeInt32BE(0, 5) // success

  // ReadyForQuery message
  const ready = Buffer.alloc(6)
  ready.writeUInt8(0x5a, 0) // 'Z'
  ready.writeInt32BE(5, 1) // length
  ready.writeUInt8(0x49, 5) // 'I' = idle

  return Buffer.concat([authOk, ready])
}

/**
 * Builds a PostgreSQL ErrorResponse message.
 *
 * ErrorResponse: 'E' + int32(length) + fields + null terminator
 * Fields: byte(type) + null-terminated string
 */
export function buildErrorResponse(message: string): Buffer {
  // Severity field: 'S' + "ERROR\0"
  const severity = Buffer.from('SERROR\0', 'utf8')
  // Message field: 'M' + message + '\0'
  const msgField = Buffer.concat([Buffer.from('M', 'utf8'), Buffer.from(message + '\0', 'utf8')])
  // Code field: 'C' + "XX000\0" (internal error)
  const code = Buffer.from('CXX000\0', 'utf8')
  // Null terminator for the message
  const terminator = Buffer.from([0])

  const bodyLength = severity.length + msgField.length + code.length + terminator.length
  const header = Buffer.alloc(5)
  header.writeUInt8(0x45, 0) // 'E'
  header.writeInt32BE(bodyLength + 4, 1) // length includes itself

  return Buffer.concat([header, severity, code, msgField, terminator])
}
