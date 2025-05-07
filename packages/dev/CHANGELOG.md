# Changelog

## [2.2.0](https://github.com/netlify/primitives/compare/dev-v2.1.2...dev-v2.2.0) (2025-05-07)


### Features

* add separate package for types ([#175](https://github.com/netlify/primitives/issues/175)) ([bb70188](https://github.com/netlify/primitives/commit/bb7018856ebda7a52ccff291cb306478e2853468))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/blobs bumped from 9.0.1 to 9.1.0
    * @netlify/functions bumped from 3.1.5 to 3.1.6
    * @netlify/runtime bumped from 2.1.1 to 2.2.0
  * devDependencies
    * @netlify/types bumped from 1.0.0 to 1.1.0

## [2.1.2](https://github.com/netlify/primitives/compare/dev-v2.1.1...dev-v2.1.2) (2025-05-06)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/runtime bumped from 2.1.0 to 2.1.1

## [2.1.1](https://github.com/netlify/primitives/compare/dev-v2.1.0...dev-v2.1.1) (2025-05-06)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/functions bumped from 3.1.4 to 3.1.5

## [2.1.0](https://github.com/netlify/primitives/compare/dev-v2.0.0...dev-v2.1.0) (2025-05-06)


### Features

* add Vite plugin ([#165](https://github.com/netlify/primitives/issues/165)) ([2ec775e](https://github.com/netlify/primitives/commit/2ec775e29be11138f77f8db73e2a3bcfdbe88934))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/blobs bumped from 9.0.0 to 9.0.1
    * @netlify/dev-utils bumped from 2.0.0 to 2.1.0
    * @netlify/functions bumped from 3.1.3 to 3.1.4
    * @netlify/redirects bumped from 1.1.1 to 1.1.2
    * @netlify/runtime bumped from 2.0.0 to 2.1.0
    * @netlify/static bumped from 1.1.1 to 1.1.2

## [2.0.0](https://github.com/netlify/primitives/compare/dev-v1.1.2...dev-v2.0.0) (2025-05-02)


### ⚠ BREAKING CHANGES

* The `BlobsServer` class now only exports the `start()` and `stop()` methods. This class is not part of the Netlify Blobs client, and it's mostly used internally by Netlify tooling and by some users for integration tests — if you're just using the methods listed in https://docs.netlify.com/blobs/overview/#api-reference, this change does not apply to you and you can safely upgrade.

### Features

* add `start` entry point ([#154](https://github.com/netlify/primitives/issues/154)) ([b23c607](https://github.com/netlify/primitives/commit/b23c607ed3aa5e76279efa773b8c6c4d0dee972c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/blobs bumped from 8.2.0 to 9.0.0
    * @netlify/dev-utils bumped from 1.1.0 to 2.0.0
    * @netlify/functions bumped from 3.1.2 to 3.1.3
    * @netlify/redirects bumped from 1.1.0 to 1.1.1
    * @netlify/runtime bumped from 1.0.0 to 2.0.0
    * @netlify/static bumped from 1.1.0 to 1.1.1

## [1.1.2](https://github.com/netlify/primitives/compare/dev-v1.1.1...dev-v1.1.2) (2025-04-16)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/functions bumped from 3.1.1 to 3.1.2

## [1.1.1](https://github.com/netlify/primitives/compare/dev-v1.1.0...dev-v1.1.1) (2025-04-16)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/functions bumped from 3.1.0 to 3.1.1

## [1.1.0](https://github.com/netlify/primitives/compare/dev-v1.0.0...dev-v1.1.0) (2025-04-16)


### Features

* move primitives into monorepo ([#101](https://github.com/netlify/primitives/issues/101)) ([93b72b1](https://github.com/netlify/primitives/commit/93b72b1364022e45cbd87814dc6aa235f1e1c83e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/dev-utils bumped from 1.0.0 to 1.1.0
    * @netlify/functions bumped from 2.8.2 to 3.1.0
    * @netlify/redirects bumped from 1.0.0 to 1.1.0
    * @netlify/static bumped from 1.0.0 to 1.1.0
