export const ERROR_CODES = {
  invalid_vary:
    'Responses must not use unsupported directives of the `Netlify-Vary` header (https://ntl.fyi/cache_api_invalid_vary).',
  no_cache:
    'Responses must not set cache control headers with the `private`, `no-cache` or `no-store` directives (https://ntl.fyi/cache_api_no_cache).',
  low_ttl:
    'Responses must have a cache control header with a `max-age` or `s-maxage` directive (https://ntl.fyi/cache_api_low_ttl).',
  no_directive:
    'Responses must have a cache control header with caching directives (https://ntl.fyi/cache_api_no_directive).',
  no_ttl:
    'Responses must have a cache control header with a `max-age` or `s-maxage` directive (https://ntl.fyi/cache_api_no_ttl).',
  no_status: 'Responses must specify a status code (https://ntl.fyi/cache_api_no_status).',
  invalid_directive:
    'Responses must have a cache control header with caching directives (https://ntl.fyi/cache_api_invalid_directive).',
  status: 'Responses must have a status code between 200 and 299 (https://ntl.fyi/cache_api_status).',
}

export const GENERIC_ERROR = 'The server has returned an unexpected error (https://ntl.fyi/cache_api_error).'
