import { expect, test } from 'vitest'

import { parseSizeMB } from './size.js'

test.each([
  [2048, 2048],
  ['2048', 2048],
  ['512mb', 512],
  ['4gb', 4096],
  ['4 GB', 4096],
  [' 4gb ', 4096],
  ['1.5gb', 1536],
])('reads %j as %d megabytes', (input, megabytes) => {
  expect(parseSizeMB(input)).toBe(megabytes)
})

test.each(['', 'lots', '4tb', '-1gb', 'gb'])('returns NaN for %j', (input) => {
  expect(parseSizeMB(input)).toBeNaN()
})
