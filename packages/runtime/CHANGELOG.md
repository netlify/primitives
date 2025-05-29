# Changelog

## [3.0.0](https://github.com/netlify/primitives/compare/runtime-v2.2.2...runtime-v3.0.0) (2025-05-28)


### ⚠ BREAKING CHANGES

* fix `engines.node` ([#210](https://github.com/netlify/primitives/issues/210))

### Bug Fixes

* remove unused dependencies, add undeclared dependencies ([#230](https://github.com/netlify/primitives/issues/230)) ([180546a](https://github.com/netlify/primitives/commit/180546aa03b569000ed52cafb07014e9a4c76a1a))


### Build System

* fix `engines.node` ([#210](https://github.com/netlify/primitives/issues/210)) ([5604545](https://github.com/netlify/primitives/commit/56045450d0f6c24988a8956c1946209bda4502bc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/blobs bumped from ^9.1.2 to ^9.1.3
    * @netlify/cache bumped from 1.11.2 to 2.0.0
    * @netlify/runtime-utils bumped from 1.3.1 to 2.0.0
    * @netlify/types bumped from 1.2.0 to 2.0.0
  * devDependencies
    * @netlify/dev-utils bumped from ^2.2.0 to ^3.0.0

## [2.2.2](https://github.com/netlify/primitives/compare/runtime-v2.2.1...runtime-v2.2.2) (2025-05-23)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/cache bumped from 1.11.1 to 1.11.2
    * @netlify/types bumped from 1.1.1 to 1.2.0

## [2.2.1](https://github.com/netlify/primitives/compare/runtime-v2.2.0...runtime-v2.2.1) (2025-05-09)


### Bug Fixes

* fix package settings and add publint ([#180](https://github.com/netlify/primitives/issues/180)) ([dc093b4](https://github.com/netlify/primitives/commit/dc093b4bece80c79b73981602033e60497f87aa4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/cache bumped from 1.11.0 to 1.11.1
    * @netlify/runtime-utils bumped from 1.3.0 to 1.3.1
    * @netlify/types bumped from 1.1.0 to 1.1.1

## [2.2.0](https://github.com/netlify/primitives/compare/runtime-v2.1.1...runtime-v2.2.0) (2025-05-07)


### Features

* add separate package for types ([#175](https://github.com/netlify/primitives/issues/175)) ([bb70188](https://github.com/netlify/primitives/commit/bb7018856ebda7a52ccff291cb306478e2853468))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/cache bumped from 1.10.0 to 1.11.0
    * @netlify/runtime-utils bumped from 1.2.0 to 1.3.0
    * @netlify/types bumped from 1.0.0 to 1.1.0

## [2.1.1](https://github.com/netlify/primitives/compare/runtime-v2.1.0...runtime-v2.1.1) (2025-05-06)


### Bug Fixes

* adjust dependencies and exports ([#169](https://github.com/netlify/primitives/issues/169)) ([7ebbd3a](https://github.com/netlify/primitives/commit/7ebbd3aa3126c8ebe6c9880c62b3ad50b0b219c2))

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
