import { expect, test } from 'vitest'

import * as main from './main.js'

test('Main file does not export anything', () => {
  expect(Object.keys(main)).toStrictEqual([])
})
