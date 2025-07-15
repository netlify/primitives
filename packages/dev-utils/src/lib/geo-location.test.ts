import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

import { getGeoLocation, mockLocation } from './geo-location.js'
import { MockFetch } from '../test/fetch.js'

describe('geolocation', () => {
  let mockState: { get: vi.Mock; set: vi.Mock }
  let mockFetch: MockFetch

  beforeEach(() => {
    vi.clearAllMocks()
    mockState = {
      get: vi.fn(),
      set: vi.fn(),
    }
    mockFetch = new MockFetch()
  })

  afterEach(() => {
    mockFetch.restore()
  })

  describe('getGeoLocation', () => {
    test('returns mock location when mode is "mock"', async () => {
      const result = await getGeoLocation({
        mode: 'mock',
        state: mockState,
      })

      expect(result).toEqual(mockLocation)
      expect(mockState.get).not.toHaveBeenCalled()
      expect(mockState.set).not.toHaveBeenCalled()
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('returns custom mock location when geoCountry is provided', async () => {
      const result = await getGeoLocation({
        mode: 'cache',
        geoCountry: 'FR',
        state: mockState,
      })

      expect(result).toEqual({
        city: 'Mock City',
        country: { code: 'FR', name: 'Mock Country' },
        subdivision: { code: 'SD', name: 'Mock Subdivision' },
        longitude: 0,
        latitude: 0,
        timezone: 'UTC',
      })
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('returns cached data when mode is "cache" and data is fresh', async () => {
      const cachedData = {
        city: 'Cached City',
        country: { code: 'CA', name: 'Canada' },
        subdivision: { code: 'ON', name: 'Ontario' },
        longitude: -79.3832,
        latitude: 43.6532,
        timezone: 'America/Toronto',
      }

      mockState.get.mockReturnValue({
        data: cachedData,
        timestamp: Date.now() - 1000 * 60 * 60, // 1 hour ago
      })

      const result = await getGeoLocation({
        mode: 'cache',
        state: mockState,
      })

      expect(result).toEqual(cachedData)
      expect(mockState.get).toHaveBeenCalledWith('geolocation')
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('fetches new data when mode is "cache" but data is stale', async () => {
      const staleData = {
        city: 'Stale City',
        country: { code: 'CA', name: 'Canada' },
        subdivision: { code: 'ON', name: 'Ontario' },
        longitude: -79.3832,
        latitude: 43.6532,
        timezone: 'America/Toronto',
      }

      const freshData = {
        city: 'Fresh City',
        country: { code: 'US', name: 'United States' },
        subdivision: { code: 'NY', name: 'New York' },
        longitude: -74.006,
        latitude: 40.7128,
        timezone: 'America/New_York',
      }

      mockState.get.mockReturnValue({
        data: staleData,
        timestamp: Date.now() - 1000 * 60 * 60 * 25, // 25 hours ago (stale)
      })

      mockFetch
        .get({
          url: 'https://netlifind.netlify.app',
          response: new Response(JSON.stringify({ geo: freshData }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        })
        .inject()

      const result = await getGeoLocation({
        mode: 'cache',
        state: mockState,
      })

      expect(result).toEqual(freshData)
      expect(mockState.get).toHaveBeenCalledWith('geolocation')
      expect(mockState.set).toHaveBeenCalledWith('geolocation', {
        data: freshData,
        timestamp: expect.any(Number),
      })
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('always fetches new data when mode is "update"', async () => {
      const cachedData = {
        city: 'Cached City',
        country: { code: 'CA', name: 'Canada' },
        subdivision: { code: 'ON', name: 'Ontario' },
        longitude: -79.3832,
        latitude: 43.6532,
        timezone: 'America/Toronto',
      }

      const freshData = {
        city: 'Fresh City',
        country: { code: 'US', name: 'United States' },
        subdivision: { code: 'NY', name: 'New York' },
        longitude: -74.006,
        latitude: 40.7128,
        timezone: 'America/New_York',
      }

      mockState.get.mockReturnValue({
        data: cachedData,
        timestamp: Date.now() - 1000 * 60 * 60, // 1 hour ago (fresh)
      })

      mockFetch
        .get({
          url: 'https://netlifind.netlify.app',
          response: new Response(JSON.stringify({ geo: freshData }), {
            headers: { 'Content-Type': 'application/json' },
          }),
        })
        .inject()

      const result = await getGeoLocation({
        mode: 'update',
        state: mockState,
      })

      expect(result).toEqual(freshData)
      expect(mockState.set).toHaveBeenCalledWith('geolocation', {
        data: freshData,
        timestamp: expect.any(Number),
      })
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('uses cached data when offline is true, even if stale', async () => {
      const cachedData = {
        city: 'Cached City',
        country: { code: 'CA', name: 'Canada' },
        subdivision: { code: 'ON', name: 'Ontario' },
        longitude: -79.3832,
        latitude: 43.6532,
        timezone: 'America/Toronto',
      }

      mockState.get.mockReturnValue({
        data: cachedData,
        timestamp: Date.now() - 1000 * 60 * 60 * 25, // 25 hours ago (stale)
      })

      const result = await getGeoLocation({
        mode: 'cache',
        offline: true,
        state: mockState,
      })

      expect(result).toEqual(cachedData)
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('returns mock location when offline is true and no cached data', async () => {
      mockState.get.mockReturnValue(undefined)

      const result = await getGeoLocation({
        mode: 'update',
        offline: true,
        state: mockState,
      })

      expect(result).toEqual(mockLocation)
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('returns mock location when API request fails', async () => {
      mockState.get.mockReturnValue(undefined)

      mockFetch
        .get({
          url: 'https://netlifind.netlify.app',
          response: new Error('Network error'),
        })
        .inject()

      const result = await getGeoLocation({
        mode: 'update',
        state: mockState,
      })

      expect(result).toEqual(mockLocation)
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('uses cached data when country matches geoCountry', async () => {
      const cachedData = {
        city: 'Paris',
        country: { code: 'FR', name: 'France' },
        subdivision: { code: 'IDF', name: 'Île-de-France' },
        longitude: 2.3522,
        latitude: 48.8566,
        timezone: 'Europe/Paris',
      }

      mockState.get.mockReturnValue({
        data: cachedData,
        timestamp: Date.now() - 1000 * 60 * 60 * 25, // 25 hours ago (stale)
      })

      const result = await getGeoLocation({
        mode: 'update',
        geoCountry: 'FR',
        state: mockState,
      })

      expect(result).toEqual(cachedData)
      expect(mockFetch.fulfilled).toBe(true)
    })
  })
})
