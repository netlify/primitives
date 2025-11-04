import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import type { MockedFunction } from 'vitest'

import { getGeoLocation, mockLocation } from './geo-location.js'
import { MockFetch } from '../test/fetch.js'

describe('geolocation', () => {
  let mockState: {
    get: MockedFunction<(key: string) => unknown>
    set: MockedFunction<(key: string, value: unknown) => void>
  }
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
    test('returns mock location when enabled is false', async () => {
      const result = await getGeoLocation({
        enabled: false,
        state: mockState,
      })

      expect(result).toEqual(mockLocation)
      expect(mockState.get).not.toHaveBeenCalled()
      expect(mockState.set).not.toHaveBeenCalled()
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('returns cached data when cache is enabled and data is fresh', async () => {
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
        enabled: true,
        cache: true,
        state: mockState,
      })

      expect(result).toEqual(cachedData)
      expect(mockState.get).toHaveBeenCalledWith('geolocation')
      expect(mockFetch.fulfilled).toBe(true)
    })

    test('fetches new data when cache is enabled but data is stale', async () => {
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
        enabled: true,
        cache: true,
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

    test('always fetches new data when cache is disabled', async () => {
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
        enabled: true,
        cache: false,
        state: mockState,
      })

      expect(result).toEqual(freshData)
      expect(mockState.set).toHaveBeenCalledWith('geolocation', {
        data: freshData,
        timestamp: expect.any(Number),
      })
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
        enabled: true,
        cache: false,
        state: mockState,
      })

      expect(result).toEqual(mockLocation)
      expect(mockFetch.fulfilled).toBe(true)
    })
  })
})
