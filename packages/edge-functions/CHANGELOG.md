# Changelog

## [2.15.5](https://github.com/netlify/primitives/compare/edge-functions-v2.15.4...edge-functions-v2.15.5) (2025-07-04)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/dev-utils bumped from 3.2.1 to 3.2.2

## [2.15.4](https://github.com/netlify/primitives/compare/edge-functions-v2.15.3...edge-functions-v2.15.4) (2025-06-26)


### Bug Fixes

* add missing await and let server process be collected ([#319](https://github.com/netlify/primitives/issues/319)) ([1724d50](https://github.com/netlify/primitives/commit/1724d507b844a3b8e1ccb0b6c84a7e80d70d4d4c))

## [2.15.3](https://github.com/netlify/primitives/compare/edge-functions-v2.15.2...edge-functions-v2.15.3) (2025-06-26)


### Bug Fixes

* **deps:** update dependency @netlify/edge-functions-bootstrap to ^2.14.0 ([#314](https://github.com/netlify/primitives/issues/314)) ([f52f332](https://github.com/netlify/primitives/commit/f52f332abcd51093dbd6d7ab05cccff931a22a52))

## [2.15.2](https://github.com/netlify/primitives/compare/edge-functions-v2.15.1...edge-functions-v2.15.2) (2025-06-25)


### Bug Fixes

* **edge:** note when stopped so we can kill process in early init ([#313](https://github.com/netlify/primitives/issues/313)) ([3062d40](https://github.com/netlify/primitives/commit/3062d400e4b8387c43c6c03713c58d3b29325a5d))

## [2.15.1](https://github.com/netlify/primitives/compare/edge-functions-v2.15.0...edge-functions-v2.15.1) (2025-06-18)


### Bug Fixes

* clean up edge functions server ([#310](https://github.com/netlify/primitives/issues/310)) ([243f3b4](https://github.com/netlify/primitives/commit/243f3b472d1350eb6a80d8f736385750de8bc0d4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/dev-utils bumped from 3.2.0 to 3.2.1

## [2.15.0](https://github.com/netlify/primitives/compare/edge-functions-v2.14.5...edge-functions-v2.15.0) (2025-06-17)


### Features

* add `serverAddress` to request handler ([#308](https://github.com/netlify/primitives/issues/308)) ([fa811f2](https://github.com/netlify/primitives/commit/fa811f24d473d471108f560abc484d17ea11bd70))

## [2.14.5](https://github.com/netlify/primitives/compare/edge-functions-v2.14.4...edge-functions-v2.14.5) (2025-06-06)


### Bug Fixes

* fix edge functions workers ([#298](https://github.com/netlify/primitives/issues/298)) ([0666593](https://github.com/netlify/primitives/commit/0666593a6d3d8cf85a0718025e5c0b11c120563c))

## [2.14.4](https://github.com/netlify/primitives/compare/edge-functions-v2.14.3...edge-functions-v2.14.4) (2025-06-06)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/dev-utils bumped from 3.1.1 to 3.2.0

## [2.14.3](https://github.com/netlify/primitives/compare/edge-functions-v2.14.2...edge-functions-v2.14.3) (2025-06-06)


### Bug Fixes

* **deps:** update netlify packages ([#290](https://github.com/netlify/primitives/issues/290)) ([ca10da6](https://github.com/netlify/primitives/commit/ca10da69a916ef29bb6251822548f9dbefb58d06))
* fix `@netlify/edge-functions` exports ([#289](https://github.com/netlify/primitives/issues/289)) ([cfb8fac](https://github.com/netlify/primitives/commit/cfb8fac01437452168686f64a2afe76c990fe63e))

## [2.14.2](https://github.com/netlify/primitives/compare/edge-functions-v2.14.1...edge-functions-v2.14.2) (2025-06-04)


### Bug Fixes

* reinstate missing edge functions types ([#280](https://github.com/netlify/primitives/issues/280)) ([f4360c9](https://github.com/netlify/primitives/commit/f4360c955812e7b96dfb1b0f8112d70496488ee2))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @netlify/types bumped from 2.0.1 to 2.0.2

## [2.14.1](https://github.com/netlify/primitives/compare/edge-functions-v2.14.0...edge-functions-v2.14.1) (2025-06-03)


### Bug Fixes

* revamp dev and vite plugin logging ([#269](https://github.com/netlify/primitives/issues/269)) ([de9b46c](https://github.com/netlify/primitives/commit/de9b46c1cb1c7b2bf6437ab516134e44203d83b7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/dev-utils bumped from 3.1.0 to 3.1.1

## [2.14.0](https://github.com/netlify/primitives/compare/edge-functions-v2.13.2...edge-functions-v2.14.0) (2025-06-03)


### Features

* accept `IncomingMessage` in handler ([#267](https://github.com/netlify/primitives/issues/267)) ([aa84022](https://github.com/netlify/primitives/commit/aa84022cf9ecb2258dce39b87b0a21ec73524914))

## [2.13.2](https://github.com/netlify/primitives/compare/edge-functions-v2.13.1...edge-functions-v2.13.2) (2025-06-03)


### Bug Fixes

* pass run options to Deno script as arg ([#263](https://github.com/netlify/primitives/issues/263)) ([ec414cc](https://github.com/netlify/primitives/commit/ec414ccae9e40585b0cf5aa3bfe26992499fe47c))

## [2.13.1](https://github.com/netlify/primitives/compare/edge-functions-v2.13.0...edge-functions-v2.13.1) (2025-06-02)


### Bug Fixes

* move deno typescript files to mjs + jsdoc ([#260](https://github.com/netlify/primitives/issues/260)) ([32fd66a](https://github.com/netlify/primitives/commit/32fd66a28f3cac321fd24fbab0b59fd46e126920))

## [2.13.0](https://github.com/netlify/primitives/compare/edge-functions-v2.12.0...edge-functions-v2.13.0) (2025-06-02)


### Features

* add support for edge functions ([#233](https://github.com/netlify/primitives/issues/233)) ([c80d77d](https://github.com/netlify/primitives/commit/c80d77ddf59e394f9d8a84a96275c25c1b9aefc0))
* improve error handling in edge functions ([#246](https://github.com/netlify/primitives/issues/246)) ([c0be696](https://github.com/netlify/primitives/commit/c0be6963c8bd9a49bb967040c29580e7facaae03))


### Bug Fixes

* **deps:** update dependency @netlify/edge-bundler to ^14.0.5 ([#243](https://github.com/netlify/primitives/issues/243)) ([44f18de](https://github.com/netlify/primitives/commit/44f18de491828e08d13d59622a7ec0554cffa21b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @netlify/dev-utils bumped from 3.0.0 to 3.1.0
    * @netlify/runtime-utils bumped from 2.0.0 to 2.1.0
  * devDependencies
    * @netlify/types bumped from 1.2.0 to 2.0.1

## Changelog
