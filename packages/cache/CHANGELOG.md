# Changelog

## [3.0.8](https://github.com/netlify/primitives/compare/cache-v3.0.7...cache-v3.0.8) (2025-07-23)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/dev-utils bumped from 4.0.0 to 4.1.0

## [3.0.7](https://github.com/netlify/primitives/compare/cache-v3.0.6...cache-v3.0.7) (2025-07-17)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/dev-utils bumped from 3.3.0 to 4.0.0

## [3.0.6](https://github.com/netlify/primitives/compare/cache-v3.0.5...cache-v3.0.6) (2025-07-15)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/dev-utils bumped from 3.2.2 to 3.3.0

## [3.0.5](https://github.com/netlify/primitives/compare/cache-v3.0.4...cache-v3.0.5) (2025-07-04)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/dev-utils bumped from 3.2.1 to 3.2.2

## [3.0.4](https://github.com/netlify/primitives/compare/cache-v3.0.3...cache-v3.0.4) (2025-06-18)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/dev-utils bumped from 3.2.0 to 3.2.1

## [3.0.3](https://github.com/netlify/primitives/compare/cache-v3.0.2...cache-v3.0.3) (2025-06-06)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/dev-utils bumped from 3.1.1 to 3.2.0

## [3.0.2](https://github.com/netlify/primitives/compare/cache-v3.0.1...cache-v3.0.2) (2025-06-04)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/types bumped from 2.0.1 to 2.0.2

## [3.0.1](https://github.com/netlify/primitives/compare/cache-v3.0.0...cache-v3.0.1) (2025-06-03)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/dev-utils bumped from 3.1.0 to 3.1.1

## [3.0.0](https://github.com/netlify/primitives/compare/cache-v2.0.0...cache-v3.0.0) (2025-06-02)


### ⚠ BREAKING CHANGES

* drop EOL'd node 18 support in new packages ([#252](https://github.com/netlify/primitives/issues/252))

### Features

* add support for edge functions ([#233](https://github.com/netlify/primitives/issues/233)) ([c80d77d](https://github.com/netlify/primitives/commit/c80d77ddf59e394f9d8a84a96275c25c1b9aefc0))


### Bug Fixes

* drop EOL'd node 18 support in new packages ([#252](https://github.com/netlify/primitives/issues/252)) ([38791ab](https://github.com/netlify/primitives/commit/38791ab91dcbf1f05093ba123eaccdf960a2d6e7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/runtime-utils bumped from 2.0.0 to 2.1.0
  * devDependencies
    * @netlify/dev-utils bumped from 3.0.0 to 3.1.0
    * @netlify/types bumped from 2.0.0 to 2.0.1

## [2.0.0](https://github.com/netlify/primitives/compare/cache-v1.11.2...cache-v2.0.0) (2025-05-28)


### ⚠ BREAKING CHANGES

* fix `engines.node` ([#210](https://github.com/netlify/primitives/issues/210))

### Bug Fixes

* remove unused dependencies, add undeclared dependencies ([#230](https://github.com/netlify/primitives/issues/230)) ([180546a](https://github.com/netlify/primitives/commit/180546aa03b569000ed52cafb07014e9a4c76a1a))
* retain request headers in cache lookups ([#204](https://github.com/netlify/primitives/issues/204)) ([6fa04b5](https://github.com/netlify/primitives/commit/6fa04b5990bafaecfef70cb9a510c24fd31a8e15))


### Build System

* fix `engines.node` ([#210](https://github.com/netlify/primitives/issues/210)) ([5604545](https://github.com/netlify/primitives/commit/56045450d0f6c24988a8956c1946209bda4502bc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/runtime-utils bumped from 1.3.1 to 2.0.0
  * devDependencies
    * @netlify/dev-utils bumped from 2.2.0 to 3.0.0
    * @netlify/types bumped from 1.2.0 to 2.0.0

## [1.11.2](https://github.com/netlify/primitives/compare/cache-v1.11.1...cache-v1.11.2) (2025-05-23)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/dev-utils bumped from 2.1.1 to 2.2.0
    * @netlify/types bumped from 1.1.1 to 1.2.0

## [1.11.1](https://github.com/netlify/primitives/compare/cache-v1.11.0...cache-v1.11.1) (2025-05-09)


### Bug Fixes

* fix package settings and add publint ([#180](https://github.com/netlify/primitives/issues/180)) ([dc093b4](https://github.com/netlify/primitives/commit/dc093b4bece80c79b73981602033e60497f87aa4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/runtime-utils bumped from 1.3.0 to 1.3.1
  * devDependencies
    * @netlify/dev-utils bumped from 2.1.0 to 2.1.1
    * @netlify/types bumped from 1.1.0 to 1.1.1

## [1.11.0](https://github.com/netlify/primitives/compare/cache-v1.10.0...cache-v1.11.0) (2025-05-07)


### Features

* add separate package for types ([#175](https://github.com/netlify/primitives/issues/175)) ([bb70188](https://github.com/netlify/primitives/commit/bb7018856ebda7a52ccff291cb306478e2853468))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/runtime-utils bumped from 1.2.0 to 1.3.0
  * devDependencies
    * @netlify/types bumped from 1.0.0 to 1.1.0

## [1.10.0](https://github.com/netlify/primitives/compare/cache-v1.9.0...cache-v1.10.0) (2025-05-06)


### Features

* make `fetchWithCache` use `waitUntil` if available ([#161](https://github.com/netlify/primitives/issues/161)) ([dd9b7fd](https://github.com/netlify/primitives/commit/dd9b7fd5d0bd8b236d446d3211bfe880fedf4887))


### Bug Fixes

* make type definition for CacheStorage and Cache be the same as the one in TypeScript's generated dom type definition ([#166](https://github.com/netlify/primitives/issues/166)) ([c3ec2ed](https://github.com/netlify/primitives/commit/c3ec2ed3f1037f5a216a73af36050c314e7d6c89))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/runtime-utils bumped from 1.1.0 to 1.2.0
  * devDependencies
    * @netlify/dev-utils bumped from 2.0.0 to 2.1.0

## [1.9.0](https://github.com/netlify/primitives/compare/cache-v1.8.2...cache-v1.9.0) (2025-05-02)


### Features

* add `runtime` and `runtime-utils` packages ([#150](https://github.com/netlify/primitives/issues/150)) ([be2cbf0](https://github.com/netlify/primitives/commit/be2cbf05cd3b73a795b54f94b7f51dacbcf6ef34))


### Bug Fixes

* manually tee response body in `fetchWithCache` ([#158](https://github.com/netlify/primitives/issues/158)) ([199590f](https://github.com/netlify/primitives/commit/199590f583711e92e133eedb694ce85e4cc7c7d4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/runtime-utils bumped from 1.0.0 to 1.1.0
  * devDependencies
    * @netlify/dev-utils bumped from 1.1.0 to 2.0.0

## [1.8.2](https://github.com/netlify/primitives/compare/cache-v1.8.1...cache-v1.8.2) (2025-04-15)


### Bug Fixes

* simplify build command ([#118](https://github.com/netlify/primitives/issues/118)) ([bd744d5](https://github.com/netlify/primitives/commit/bd744d5cce2f46d895bc063325a9d89bb769df99))

## [1.8.1](https://github.com/netlify/primitives/compare/cache-v1.8.0...cache-v1.8.1) (2025-04-15)


### Bug Fixes

* use a proxy for the `caches` export ([#105](https://github.com/netlify/primitives/issues/105)) ([c4c11ce](https://github.com/netlify/primitives/commit/c4c11ce426dc9b9323d223e9b820f5dc11a3e1ee))

## [1.8.0](https://github.com/netlify/primitives/compare/cache-v1.5.0...cache-v1.8.0) (2025-04-15)


### Features

* add `caches` export ([#102](https://github.com/netlify/primitives/issues/102)) ([371780d](https://github.com/netlify/primitives/commit/371780d80c1e52dbf904fe1f5858bb7dd5183791))
* add `logger` option ([#96](https://github.com/netlify/primitives/issues/96)) ([4017d6e](https://github.com/netlify/primitives/commit/4017d6e05ed92b95dc151411cb304f6fb3b1e5e3))
* make Cache API operations no-ops when context is null ([#90](https://github.com/netlify/primitives/issues/90)) ([240871d](https://github.com/netlify/primitives/commit/240871d1d20f99b0dbe48eeae14980d4d6b9ba1e))
* move logger to request context ([#98](https://github.com/netlify/primitives/issues/98)) ([c0faba6](https://github.com/netlify/primitives/commit/c0faba688229ae52041c0f0bf74c4a214de9f056))


### Bug Fixes

* emit `Operation` enum ([#94](https://github.com/netlify/primitives/issues/94)) ([eed9bd5](https://github.com/netlify/primitives/commit/eed9bd5cc04f567c4baa07cc0904291a2b94f90c))


### Miscellaneous Chores

* release 1.6.1 ([7010f09](https://github.com/netlify/primitives/commit/7010f09dc3d8640a983c14cf9a325ee7615c5c77))

## [1.7.1](https://github.com/netlify/primitives/compare/cache-v1.5.0...cache-v1.7.1) (2025-03-19)


### Features

* add `logger` option ([#96](https://github.com/netlify/primitives/issues/96)) ([4017d6e](https://github.com/netlify/primitives/commit/4017d6e05ed92b95dc151411cb304f6fb3b1e5e3))
* make Cache API operations no-ops when context is null ([#90](https://github.com/netlify/primitives/issues/90)) ([240871d](https://github.com/netlify/primitives/commit/240871d1d20f99b0dbe48eeae14980d4d6b9ba1e))
* move logger to request context ([#98](https://github.com/netlify/primitives/issues/98)) ([c0faba6](https://github.com/netlify/primitives/commit/c0faba688229ae52041c0f0bf74c4a214de9f056))


### Bug Fixes

* emit `Operation` enum ([#94](https://github.com/netlify/primitives/issues/94)) ([eed9bd5](https://github.com/netlify/primitives/commit/eed9bd5cc04f567c4baa07cc0904291a2b94f90c))


### Miscellaneous Chores

* release 1.6.1 ([7010f09](https://github.com/netlify/primitives/commit/7010f09dc3d8640a983c14cf9a325ee7615c5c77))

## [1.7.0](https://github.com/netlify/primitives/compare/cache-v1.5.0...cache-v1.7.0) (2025-03-19)


### Features

* add `logger` option ([#96](https://github.com/netlify/primitives/issues/96)) ([4017d6e](https://github.com/netlify/primitives/commit/4017d6e05ed92b95dc151411cb304f6fb3b1e5e3))
* make Cache API operations no-ops when context is null ([#90](https://github.com/netlify/primitives/issues/90)) ([240871d](https://github.com/netlify/primitives/commit/240871d1d20f99b0dbe48eeae14980d4d6b9ba1e))


### Bug Fixes

* emit `Operation` enum ([#94](https://github.com/netlify/primitives/issues/94)) ([eed9bd5](https://github.com/netlify/primitives/commit/eed9bd5cc04f567c4baa07cc0904291a2b94f90c))


### Miscellaneous Chores

* release 1.6.1 ([7010f09](https://github.com/netlify/primitives/commit/7010f09dc3d8640a983c14cf9a325ee7615c5c77))

## [1.6.1](https://github.com/netlify/primitives/compare/cache-v1.5.0...cache-v1.6.1) (2025-03-19)


### Features

* make Cache API operations no-ops when context is null ([#90](https://github.com/netlify/primitives/issues/90)) ([240871d](https://github.com/netlify/primitives/commit/240871d1d20f99b0dbe48eeae14980d4d6b9ba1e))


### Bug Fixes

* emit `Operation` enum ([#94](https://github.com/netlify/primitives/issues/94)) ([eed9bd5](https://github.com/netlify/primitives/commit/eed9bd5cc04f567c4baa07cc0904291a2b94f90c))


### Miscellaneous Chores

* release 1.6.1 ([7010f09](https://github.com/netlify/primitives/commit/7010f09dc3d8640a983c14cf9a325ee7615c5c77))

## [1.6.0](https://github.com/netlify/primitives/compare/cache-v1.5.0...cache-v1.6.0) (2025-03-19)


### Features

* make Cache API operations no-ops when context is null ([#90](https://github.com/netlify/primitives/issues/90)) ([240871d](https://github.com/netlify/primitives/commit/240871d1d20f99b0dbe48eeae14980d4d6b9ba1e))

## [1.5.0](https://github.com/netlify/primitives/compare/cache-v1.1.0...cache-v1.5.0) (2025-03-18)


### Features

* log failures in `cache.put` ([#38](https://github.com/netlify/primitives/issues/38)) ([b9f356a](https://github.com/netlify/primitives/commit/b9f356a2bd1b604f3fa66c032eefa099138c317b))


### Bug Fixes

* disable code-splitting to workaround an issue in deno 2.x's `deno cache` functionality ([#85](https://github.com/netlify/primitives/issues/85)) ([557a0c1](https://github.com/netlify/primitives/commit/557a0c10f9aad4d4ab4a4c49c31cf13b65bc554a))


### Miscellaneous Chores

* release 1.5.0 ([1224f51](https://github.com/netlify/primitives/commit/1224f5193c51d6a26be02962f46b4957fa595794))

## [1.4.0](https://github.com/netlify/primitives/compare/cache-v1.1.0...cache-v1.4.0) (2025-03-12)


### Features

* add `getContext` method ([#77](https://github.com/netlify/primitives/issues/77)) ([ee879ae](https://github.com/netlify/primitives/commit/ee879aece706ba5e34fe1e8d46392580c4a7a7b9))
* export time interval constants ([#81](https://github.com/netlify/primitives/issues/81)) ([60f048b](https://github.com/netlify/primitives/commit/60f048b7ba42cfee1e62725dbc67633b738d4308))
* fix release ([0b1d397](https://github.com/netlify/primitives/commit/0b1d3975c6383b0376cbf8e4c5d2541cd9c43e4d))
* update package.json ([6f59f75](https://github.com/netlify/primitives/commit/6f59f75851edf9ef76c254b9b3ddd33d4f1e56a3))


### Miscellaneous Chores

* release 1.3.0 ([6e7237e](https://github.com/netlify/primitives/commit/6e7237ec38221382fb2d4ec49f0c184705bd68dc))
* release 1.4.0 ([8c7c297](https://github.com/netlify/primitives/commit/8c7c2973f6d7c6b36eadfad3ce0e8f93bb84440f))

## [1.3.0](https://github.com/netlify/primitives/compare/cache-v1.1.0...cache-v1.3.0) (2025-03-12)


### Features

* add `getContext` method ([#77](https://github.com/netlify/primitives/issues/77)) ([ee879ae](https://github.com/netlify/primitives/commit/ee879aece706ba5e34fe1e8d46392580c4a7a7b9))
* export time interval constants ([#81](https://github.com/netlify/primitives/issues/81)) ([60f048b](https://github.com/netlify/primitives/commit/60f048b7ba42cfee1e62725dbc67633b738d4308))
* fix release ([0b1d397](https://github.com/netlify/primitives/commit/0b1d3975c6383b0376cbf8e4c5d2541cd9c43e4d))
* update package.json ([6f59f75](https://github.com/netlify/primitives/commit/6f59f75851edf9ef76c254b9b3ddd33d4f1e56a3))


### Miscellaneous Chores

* release 1.3.0 ([6e7237e](https://github.com/netlify/primitives/commit/6e7237ec38221382fb2d4ec49f0c184705bd68dc))

## [1.3.0](https://github.com/netlify/primitives/compare/cache-v1.1.0...cache-v1.3.0) (2025-02-24)


### Features

* add `getContext` method ([#77](https://github.com/netlify/primitives/issues/77)) ([ee879ae](https://github.com/netlify/primitives/commit/ee879aece706ba5e34fe1e8d46392580c4a7a7b9))
* fix release ([0b1d397](https://github.com/netlify/primitives/commit/0b1d3975c6383b0376cbf8e4c5d2541cd9c43e4d))
* update package.json ([6f59f75](https://github.com/netlify/primitives/commit/6f59f75851edf9ef76c254b9b3ddd33d4f1e56a3))


### Miscellaneous Chores

* release 1.3.0 ([6e7237e](https://github.com/netlify/primitives/commit/6e7237ec38221382fb2d4ec49f0c184705bd68dc))

## [1.2.0](https://github.com/netlify/primitives/compare/cache-v1.1.0...cache-v1.2.0) (2025-02-22)


### Features

* fix release ([0b1d397](https://github.com/netlify/primitives/commit/0b1d3975c6383b0376cbf8e4c5d2541cd9c43e4d))
* update package.json ([6f59f75](https://github.com/netlify/primitives/commit/6f59f75851edf9ef76c254b9b3ddd33d4f1e56a3))

## [1.2.0](https://github.com/netlify/primitives/compare/cache-v1.1.0...cache-v1.2.0) (2025-02-22)


### Features

* fix release ([0b1d397](https://github.com/netlify/primitives/commit/0b1d3975c6383b0376cbf8e4c5d2541cd9c43e4d))
* update package.json ([6f59f75](https://github.com/netlify/primitives/commit/6f59f75851edf9ef76c254b9b3ddd33d4f1e56a3))

## [1.2.0](https://github.com/netlify/primitives/compare/cache-v1.1.0...cache-v1.2.0) (2025-02-22)


### Features

* fix release ([0b1d397](https://github.com/netlify/primitives/commit/0b1d3975c6383b0376cbf8e4c5d2541cd9c43e4d))
* update package.json ([6f59f75](https://github.com/netlify/primitives/commit/6f59f75851edf9ef76c254b9b3ddd33d4f1e56a3))

## [1.2.0](https://github.com/netlify/primitives/compare/cache-v1.1.0...cache-v1.2.0) (2025-02-22)


### Features

* fix release ([0b1d397](https://github.com/netlify/primitives/commit/0b1d3975c6383b0376cbf8e4c5d2541cd9c43e4d))
* update package.json ([6f59f75](https://github.com/netlify/primitives/commit/6f59f75851edf9ef76c254b9b3ddd33d4f1e56a3))

## [1.2.0](https://github.com/netlify/primitives/compare/cache-v1.1.0...cache-v1.2.0) (2025-02-22)


### Features

* fix release ([0b1d397](https://github.com/netlify/primitives/commit/0b1d3975c6383b0376cbf8e4c5d2541cd9c43e4d))
* update package.json ([6f59f75](https://github.com/netlify/primitives/commit/6f59f75851edf9ef76c254b9b3ddd33d4f1e56a3))

## [1.2.0](https://github.com/netlify/primitives/compare/cache-v1.1.0...cache-v1.2.0) (2025-02-22)


### Features

* fix release ([0b1d397](https://github.com/netlify/primitives/commit/0b1d3975c6383b0376cbf8e4c5d2541cd9c43e4d))
* update package.json ([6f59f75](https://github.com/netlify/primitives/commit/6f59f75851edf9ef76c254b9b3ddd33d4f1e56a3))
