# Changelog

## [2.1.0](https://github.com/netlify/primitives/compare/runtime-v2.0.0...runtime-v2.1.0) (2025-05-06)


### Features

* make `fetchWithCache` use `waitUntil` if available ([#161](https://github.com/netlify/primitives/issues/161)) ([dd9b7fd](https://github.com/netlify/primitives/commit/dd9b7fd5d0bd8b236d446d3211bfe880fedf4887))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/cache bumped from 1.9.0 to 1.10.0
    * @netlify/runtime-utils bumped from 1.1.0 to 1.2.0

## [2.0.0](https://github.com/netlify/primitives/compare/runtime-v1.0.0...runtime-v2.0.0) (2025-05-02)


### ⚠ BREAKING CHANGES

* The `BlobsServer` class now only exports the `start()` and `stop()` methods. This class is not part of the Netlify Blobs client, and it's mostly used internally by Netlify tooling and by some users for integration tests — if you're just using the methods listed in https://docs.netlify.com/blobs/overview/#api-reference, this change does not apply to you and you can safely upgrade.

### Features

* add `runtime` and `runtime-utils` packages ([#150](https://github.com/netlify/primitives/issues/150)) ([be2cbf0](https://github.com/netlify/primitives/commit/be2cbf05cd3b73a795b54f94b7f51dacbcf6ef34))
* add `start` entry point ([#154](https://github.com/netlify/primitives/issues/154)) ([b23c607](https://github.com/netlify/primitives/commit/b23c607ed3aa5e76279efa773b8c6c4d0dee972c))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/cache bumped from 1.8.2 to 1.9.0
    * @netlify/runtime-utils bumped from 1.0.0 to 1.1.0

## Changelog
