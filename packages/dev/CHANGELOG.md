# Changelog

## [4.1.0](https://github.com/netlify/primitives/compare/dev-v4.0.2...dev-v4.1.0) (2025-06-03)


### Features

* accept `IncomingMessage` in handler ([#267](https://github.com/netlify/primitives/issues/267)) ([aa84022](https://github.com/netlify/primitives/commit/aa84022cf9ecb2258dce39b87b0a21ec73524914))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/edge-functions bumped from 2.13.2 to 2.14.0

## [4.0.2](https://github.com/netlify/primitives/compare/dev-v4.0.1...dev-v4.0.2) (2025-06-03)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/edge-functions bumped from 2.13.1 to 2.13.2

## [4.0.1](https://github.com/netlify/primitives/compare/dev-v4.0.0...dev-v4.0.1) (2025-06-02)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/edge-functions bumped from 2.13.0 to 2.13.1

## [4.0.0](https://github.com/netlify/primitives/compare/dev-v3.0.0...dev-v4.0.0) (2025-06-02)


### ⚠ BREAKING CHANGES

* drop EOL'd node 18 support in new packages ([#252](https://github.com/netlify/primitives/issues/252))

### Features

* add support for edge functions ([#233](https://github.com/netlify/primitives/issues/233)) ([c80d77d](https://github.com/netlify/primitives/commit/c80d77ddf59e394f9d8a84a96275c25c1b9aefc0))
* improve error handling in edge functions ([#246](https://github.com/netlify/primitives/issues/246)) ([c0be696](https://github.com/netlify/primitives/commit/c0be6963c8bd9a49bb967040c29580e7facaae03))
* print alert when using the Netlify Image CDN ([#255](https://github.com/netlify/primitives/issues/255)) ([e17dd37](https://github.com/netlify/primitives/commit/e17dd375b5aa2631b1bd10e63a7cfa9b2ec9aa96))
* support multiple directories to serve static files ([#253](https://github.com/netlify/primitives/issues/253)) ([153f6ef](https://github.com/netlify/primitives/commit/153f6efda2e681d98753ebd7a1cb487ffc55560b))


### Bug Fixes

* **deps:** update netlify packages ([#236](https://github.com/netlify/primitives/issues/236)) ([630e675](https://github.com/netlify/primitives/commit/630e675822ece3d4bca58673b0a899f5a6c06bd9))
* drop EOL'd node 18 support in new packages ([#252](https://github.com/netlify/primitives/issues/252)) ([38791ab](https://github.com/netlify/primitives/commit/38791ab91dcbf1f05093ba123eaccdf960a2d6e7))
* improve static file handler ([#248](https://github.com/netlify/primitives/issues/248)) ([eb6c134](https://github.com/netlify/primitives/commit/eb6c134965a1653b3f3bebd9ec44df334589551e))
* inject env vars even when unlinked ([#244](https://github.com/netlify/primitives/issues/244)) ([b19d790](https://github.com/netlify/primitives/commit/b19d7901f65360ae2ab72da0f4a56c77b03460da))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/blobs bumped from 9.1.3 to 9.1.4
    * @netlify/dev-utils bumped from 3.0.0 to 3.1.0
    * @netlify/edge-functions bumped from 2.12.0 to 2.13.0
    * @netlify/functions bumped from 4.0.0 to 4.1.0
    * @netlify/headers bumped from 1.0.0 to 2.0.0
    * @netlify/redirects bumped from 2.0.0 to 3.0.0
    * @netlify/runtime bumped from 3.0.0 to 4.0.0
    * @netlify/static bumped from 2.0.0 to 3.0.0
  * devDependencies
    * @netlify/types bumped from 2.0.0 to 2.0.1

## [3.0.0](https://github.com/netlify/primitives/compare/dev-v2.3.1...dev-v3.0.0) (2025-05-28)


### ⚠ BREAKING CHANGES

* fix `engines.node` ([#210](https://github.com/netlify/primitives/issues/210))

### Features

* add support for headers config ([#200](https://github.com/netlify/primitives/issues/200)) ([dca313e](https://github.com/netlify/primitives/commit/dca313ec82980231724a2d801bcc739df1d27924))


### Bug Fixes

* remove unused dependencies, add undeclared dependencies ([#230](https://github.com/netlify/primitives/issues/230)) ([180546a](https://github.com/netlify/primitives/commit/180546aa03b569000ed52cafb07014e9a4c76a1a))


### Build System

* fix `engines.node` ([#210](https://github.com/netlify/primitives/issues/210)) ([5604545](https://github.com/netlify/primitives/commit/56045450d0f6c24988a8956c1946209bda4502bc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/blobs bumped from 9.1.2 to 9.1.3
    * @netlify/dev-utils bumped from 2.2.0 to 3.0.0
    * @netlify/functions bumped from 3.1.10 to 4.0.0
    * @netlify/headers bumped from 0.0.0 to 1.0.0
    * @netlify/redirects bumped from 1.1.4 to 2.0.0
    * @netlify/runtime bumped from 2.2.2 to 3.0.0
    * @netlify/static bumped from 1.1.4 to 2.0.0
  * devDependencies
    * @netlify/types bumped from 1.2.0 to 2.0.0

## [2.3.1](https://github.com/netlify/primitives/compare/dev-v2.3.0...dev-v2.3.1) (2025-05-27)


### Bug Fixes

* **deps:** update netlify packages ([#185](https://github.com/netlify/primitives/issues/185)) ([4608a20](https://github.com/netlify/primitives/commit/4608a20d3b9e62d5dad10c7c01963c1d68a8cd75))
* pin monorepo packages ([#205](https://github.com/netlify/primitives/issues/205)) ([353a812](https://github.com/netlify/primitives/commit/353a81275dae3076465daf505c770a9218427376))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/functions bumped from 3.1.9 to 3.1.10

## [2.3.0](https://github.com/netlify/primitives/compare/dev-v2.2.2...dev-v2.3.0) (2025-05-23)


### Features

* add support for environment variables ([#197](https://github.com/netlify/primitives/issues/197)) ([03878db](https://github.com/netlify/primitives/commit/03878dbfff4e7e379b9d3e4fb6d9d783e66cc2af))


### Bug Fixes

* pass route to function invocation ([#202](https://github.com/netlify/primitives/issues/202)) ([7bb9396](https://github.com/netlify/primitives/commit/7bb939649dede2fae6642f724e3491dc598621b6))
* use ephemeral directories to serve functions ([#199](https://github.com/netlify/primitives/issues/199)) ([a749e26](https://github.com/netlify/primitives/commit/a749e2600c1245dbe7f1401ebd020a862cb8f734))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/blobs bumped from ^9.1.1 to ^9.1.2
    * @netlify/dev-utils bumped from 2.1.1 to 2.2.0
    * @netlify/functions bumped from 3.1.8 to 3.1.9
    * @netlify/redirects bumped from 1.1.3 to 1.1.4
    * @netlify/runtime bumped from 2.2.1 to 2.2.2
    * @netlify/static bumped from 1.1.3 to 1.1.4
  * devDependencies
    * @netlify/types bumped from 1.1.1 to 1.2.0

## [2.2.2](https://github.com/netlify/primitives/compare/dev-v2.2.1...dev-v2.2.2) (2025-05-09)


### Bug Fixes

* **deps:** update netlify packages ([#153](https://github.com/netlify/primitives/issues/153)) ([1fd1824](https://github.com/netlify/primitives/commit/1fd1824cd9f398921f006b0ccd538f371935d1fa))
* fix package settings and add publint ([#180](https://github.com/netlify/primitives/issues/180)) ([dc093b4](https://github.com/netlify/primitives/commit/dc093b4bece80c79b73981602033e60497f87aa4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/blobs bumped from 9.1.0 to 9.1.1
    * @netlify/dev-utils bumped from 2.1.0 to 2.1.1
    * @netlify/functions bumped from 3.1.7 to 3.1.8
    * @netlify/redirects bumped from 1.1.2 to 1.1.3
    * @netlify/runtime bumped from 2.2.0 to 2.2.1
    * @netlify/static bumped from 1.1.2 to 1.1.3
  * devDependencies
    * @netlify/types bumped from 1.1.0 to 1.1.1

## [2.2.1](https://github.com/netlify/primitives/compare/dev-v2.2.0...dev-v2.2.1) (2025-05-09)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/functions bumped from 3.1.6 to 3.1.7

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
