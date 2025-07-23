import type { Context } from '@netlify/types'

import type { LocalState } from './local-state.js'

export type Geolocation = Context['geo']

export const mockLocation: Geolocation = {
  city: 'San Francisco',
  country: { code: 'US', name: 'United States' },
  subdivision: { code: 'CA', name: 'California' },
  longitude: 0,
  latitude: 0,
  timezone: 'UTC',
}

const API_URL = 'https://netlifind.netlify.app'
const STATE_GEO_PROPERTY = 'geolocation'
// 24 hours
const CACHE_TTL = 8.64e7

// 10 seconds
const REQUEST_TIMEOUT = 1e4

/**
 * Returns geolocation data from a remote API, the local cache, or a mock location, depending on the
 * specified options.
 */
export const getGeoLocation = async ({
  enabled = true,
  cache = true,
  state,
}: {
  enabled?: boolean
  cache?: boolean
  state: LocalState
}): Promise<Geolocation> => {
  // Early return for disabled mode
  if (!enabled) {
    return mockLocation
  }

  const cacheObject = state.get(STATE_GEO_PROPERTY) as { data: Geolocation; timestamp: number } | undefined

  // If we have cached geolocation data and caching is enabled, let's try to use it.
  if (cacheObject !== undefined && cache) {
    const age = Date.now() - cacheObject.timestamp

    // Let's use the cached data if it's not older than the TTL.
    if (age < CACHE_TTL) {
      return cacheObject.data
    }
  }

  // Trying to retrieve geolocation data from the API and caching it locally.
  try {
    const data = await getGeoLocationFromAPI()

    // Always cache the data for future use
    const newCacheObject = {
      data,
      timestamp: Date.now(),
    }

    state.set(STATE_GEO_PROPERTY, newCacheObject)

    return data
  } catch {
    // We couldn't get geolocation data from the API, so let's return the
    // mock location.
    return mockLocation
  }
}

/**
 * Returns geolocation data from a remote API.
 */
const getGeoLocationFromAPI = async (): Promise<Geolocation> => {
  const res = await fetch(API_URL, {
    method: 'GET',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  })
  const { geo } = (await res.json()) as { geo: Geolocation }

  return geo
}
