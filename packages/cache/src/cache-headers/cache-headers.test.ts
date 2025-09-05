import { describe, test, expect } from 'vitest'

import { cacheHeaders } from '../main.js'
import { ONE_YEAR } from './cache-headers.js'

describe('`cacheHaders`', () => {
  describe('`tags`', () => {
    test('With `ttl`', () => {
      expect(cacheHeaders({ tags: ['tag1', 'tag2'], ttl: 50 })).toStrictEqual({
        'netlify-cdn-cache-control': 's-maxage=50',
        'netlify-cache-tag': 'tag1,tag2',
      })
    })

    test('With `overrideDeployRevalidation`', () => {
      expect(cacheHeaders({ overrideDeployRevalidation: 'tag3', tags: ['tag1', 'tag2'] })).toStrictEqual({
        'netlify-cache-id': 'tag3',
        'netlify-cache-tag': 'tag1,tag2',
      })
    })

    test('Throws when input is not array of strings', () => {
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ tags: ['tag1', true] })).toThrow()
    })
  })

  describe('`ttl`', () => {
    test('Accepts a number', () => {
      expect(cacheHeaders({ ttl: 50 })).toStrictEqual({ 'netlify-cdn-cache-control': 's-maxage=50' })
    })

    test('Accepts a string containing a number', () => {
      // @ts-expect-error Wrong type
      expect(cacheHeaders({ ttl: '50' })).toStrictEqual({ 'netlify-cdn-cache-control': 's-maxage=50' })
    })

    test('With `durable`', () => {
      expect(cacheHeaders({ durable: true, ttl: 50 })).toStrictEqual({
        'netlify-cdn-cache-control': 's-maxage=50,durable',
      })
    })

    test('Throws when input is not a number', () => {
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ ttl: new Date() })).toThrow()
    })

    test('Throws when number is not integer', () => {
      expect(() => cacheHeaders({ ttl: 31.5 })).toThrow()

      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ ttl: '31.5' })).toThrow()
    })

    test('Throws when number is negative', () => {
      expect(() => cacheHeaders({ ttl: -50 })).toThrow()
    })
  })

  describe('`swr`', () => {
    test('Accepts a number', () => {
      expect(cacheHeaders({ swr: 50 })).toStrictEqual({ 'netlify-cdn-cache-control': 'stale-while-revalidate=50' })
    })

    test('With `ttl`', () => {
      expect(cacheHeaders({ ttl: 10, swr: 50 })).toStrictEqual({
        'netlify-cdn-cache-control': 's-maxage=10,stale-while-revalidate=50',
      })
    })

    test('With `ttl` and `durable`', () => {
      expect(cacheHeaders({ durable: true, ttl: 10, swr: 50 })).toStrictEqual({
        'netlify-cdn-cache-control': 's-maxage=10,stale-while-revalidate=50,durable',
      })
    })

    test('Accepts a boolean', () => {
      expect(cacheHeaders({ swr: true })).toStrictEqual({
        'netlify-cdn-cache-control': `stale-while-revalidate=${ONE_YEAR}`,
      })
    })

    test('Accepts a string containing a number', () => {
      // @ts-expect-error Wrong type
      expect(cacheHeaders({ swr: '50' })).toStrictEqual({ 'netlify-cdn-cache-control': 'stale-while-revalidate=50' })
    })

    test('Throws when input is not a number', () => {
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ swr: new Date() })).toThrow()
    })

    test('Throws when number is not integer', () => {
      expect(() => cacheHeaders({ swr: 31.5 })).toThrow()
    })

    test('Throws when number is negative', () => {
      expect(() => cacheHeaders({ swr: -50 })).toThrow()
    })
  })

  describe('`vary`', () => {
    test('With `cookie`', () => {
      expect(cacheHeaders({ vary: { cookie: 'cookie1' } })).toStrictEqual({ 'netlify-vary': 'cookie=cookie1' })
      expect(cacheHeaders({ vary: { cookie: ['cookie1'] } })).toStrictEqual({ 'netlify-vary': 'cookie=cookie1' })
      expect(cacheHeaders({ vary: { cookie: ['cookie1', 'cookie2'] } })).toStrictEqual({
        'netlify-vary': 'cookie=cookie1|cookie2',
      })
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ vary: { cookie: true } })).toThrow()
    })

    test('With `country`', () => {
      expect(cacheHeaders({ vary: { country: 'pt' } })).toStrictEqual({ 'netlify-vary': 'country=pt' })
      expect(cacheHeaders({ vary: { country: ['es', 'pt'] } })).toStrictEqual({ 'netlify-vary': 'country=es|pt' })
      expect(cacheHeaders({ vary: { country: ['es', ['br', 'pt']] } })).toStrictEqual({
        'netlify-vary': 'country=es|br+pt',
      })
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ vary: { country: true } })).toThrow()
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ vary: { country: ['pt', 3] } })).toThrow()
    })

    test('With `header`', () => {
      expect(cacheHeaders({ vary: { header: 'Device-Type' } })).toStrictEqual({ 'netlify-vary': 'header=Device-Type' })
      expect(cacheHeaders({ vary: { header: ['Device-Type'] } })).toStrictEqual({
        'netlify-vary': 'header=Device-Type',
      })
      expect(cacheHeaders({ vary: { header: ['Device-Type', 'App-Version'] } })).toStrictEqual({
        'netlify-vary': 'header=Device-Type|App-Version',
      })
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ vary: { header: true } })).toThrow()
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ vary: { header: ['Device-Type', 3] } })).toThrow()
    })

    test('With `language`', () => {
      expect(cacheHeaders({ vary: { language: 'pt' } })).toStrictEqual({ 'netlify-vary': 'language=pt' })
      expect(cacheHeaders({ vary: { language: ['es', 'pt'] } })).toStrictEqual({ 'netlify-vary': 'language=es|pt' })
      expect(cacheHeaders({ vary: { language: ['es', ['nl', 'pt']] } })).toStrictEqual({
        'netlify-vary': 'language=es|nl+pt',
      })
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ vary: { language: true } })).toThrow()
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ vary: { language: ['pt', 3] } })).toThrow()
    })

    test('With `query`', () => {
      expect(cacheHeaders({ vary: { query: true } })).toStrictEqual({ 'netlify-vary': 'query' })
      expect(cacheHeaders({ vary: { query: 'page' } })).toStrictEqual({ 'netlify-vary': 'query=page' })
      expect(cacheHeaders({ vary: { query: ['page'] } })).toStrictEqual({
        'netlify-vary': 'query=page',
      })
      expect(cacheHeaders({ vary: { query: ['page', 'per_page'] } })).toStrictEqual({
        'netlify-vary': 'query=page|per_page',
      })
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ vary: { query: 3 } })).toThrow()
      // @ts-expect-error Wrong type
      expect(() => cacheHeaders({ vary: { query: ['page', 3] } })).toThrow()
    })

    test('With multiple', () => {
      expect(cacheHeaders({ vary: { header: ['Device-Type', 'App-Version'], query: true } })).toStrictEqual({
        'netlify-vary': 'header=Device-Type|App-Version,query',
      })
      expect(
        cacheHeaders({ vary: { country: ['es', ['br', 'pt']], header: ['Device-Type', 'App-Version'], query: true } }),
      ).toStrictEqual({
        'netlify-vary': 'country=es|br+pt,header=Device-Type|App-Version,query',
      })
    })
  })
})
