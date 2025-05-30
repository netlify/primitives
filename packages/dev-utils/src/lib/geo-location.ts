import type { Context } from '@netlify/types'

export type Geolocation = Context['geo']

export const mockLocation: Geolocation = {
  city: 'San Francisco',
  country: { code: 'US', name: 'United States' },
  subdivision: { code: 'CA', name: 'California' },
  longitude: 0,
  latitude: 0,
  timezone: 'UTC',
}
