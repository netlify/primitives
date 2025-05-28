import { expectError } from 'tsd'

import { Handler } from '../../src/main.js'

// Ensure void is NOT a valid return type in async handlers
expectError(() => {
  const handler: Handler = async () => {
    // void
  }
})
