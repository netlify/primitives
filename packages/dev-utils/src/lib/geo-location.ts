import type { Context } from '@netlify/types'

import { LocalState } from './local-state.js'

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
 * specified mode.
 */
export const getGeoLocation = async ({
  geoCountry,
  mode,
  offline = false,
  state,
}: {
  mode: 'cache' | 'update' | 'mock'
  geoCountry?: string | undefined
  offline?: boolean | undefined
  state: LocalState
}): Promise<Geolocation> => {
  // Early return for pure mock mode (no geoCountry, no offline)
  if (mode === 'mock' && !geoCountry && !offline) {
    return mockLocation
  }

  const cacheObject = state.get(STATE_GEO_PROPERTY) as { data: Geolocation; timestamp: number } | undefined

  // If we have cached geolocation data and the `--geo` option is set to
  // `cache`, let's try to use it.
  // Or, if the country we're trying to mock is the same one as we have in the
  // cache, let's use the cache instead of the mock.
  if (cacheObject !== undefined && (mode === 'cache' || cacheObject.data.country?.code === geoCountry)) {
    const age = Date.now() - cacheObject.timestamp

    // Let's use the cached data if it's not older than the TTL. Also, if the
    // `--offline` option was used, it's best to use the cached location than
    // the mock one.
    // Additionally, if we're trying to mock a country that matches the cached country,
    // prefer the cached data over the mock.
    if (age < CACHE_TTL || offline || cacheObject.data.country?.code === geoCountry) {
      return cacheObject.data
    }
  }

  // If a country code was provided, we use mock mode to generate
  // location data for that country.
  if (geoCountry) {
    mode = 'mock'
  }

  // If the mode is set to `mock`, we use the default mock location.
  // If the `offline` option was used, we can't talk to the API, so let's
  // also use the mock location. Otherwise, use the country code passed in by
  // the user.
  if (mode === 'mock' || offline || geoCountry) {
    if (geoCountry) {
      return {
        city: 'Mock City',
        country: { code: geoCountry, name: 'Mock Country' },
        subdivision: { code: 'SD', name: 'Mock Subdivision' },
        longitude: 0,
        latitude: 0,
        timezone: 'UTC',
      }
    }
    return mockLocation
  }

  // Trying to retrieve geolocation data from the API and caching it locally.
  try {
    const data = await getGeoLocationFromAPI()
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
  const { geo } = await res.json() as { geo: Geolocation }

  return geo
}
