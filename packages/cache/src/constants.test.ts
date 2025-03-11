import { test, expect } from 'vitest'

import { MINUTE, HOUR, DAY, WEEK, YEAR } from './main.js'

test('Exports time interval constants', () => {
  expect(MINUTE).toBe(60)
  expect(HOUR).toBe(60 * 60)
  expect(DAY).toBe(60 * 60 * 24)
  expect(WEEK).toBe(60 * 60 * 24 * 7)
  expect(YEAR).toBe(60 * 60 * 24 * 365)
})
