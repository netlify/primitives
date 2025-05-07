import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, expectTypeOf, test } from 'vitest'

import { Context, NetlifyGlobal } from './main.js'
import * as main from './main.js'

test('Exports types', () => {
  expectTypeOf<Context>()
  expectTypeOf<NetlifyGlobal>()
})

test('Does not export runtime code', () => {
  expect(Object.keys(main)).toStrictEqual([])
})

test('Does not have dependencies', async () => {
  const packageJSONPath = resolve(fileURLToPath(import.meta.url), '../../package.json')
  const packageJSON = await readFile(packageJSONPath, 'utf8')
  const { dependencies = {} } = JSON.parse(packageJSON)

  expect(dependencies).toStrictEqual({})
})
