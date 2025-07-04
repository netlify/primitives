# Changelog

## [3.2.2](https://github.com/netlify/primitives/compare/dev-utils-v3.2.1...dev-utils-v3.2.2) (2025-07-04)


### Bug Fixes

* **deps:** move tmp-promise to prod deps ([#329](https://github.com/netlify/primitives/issues/329)) ([f8d46bf](https://github.com/netlify/primitives/commit/f8d46bf759e15ed866436838610ddadbb06c0de1))

## [3.2.1](https://github.com/netlify/primitives/compare/dev-utils-v3.2.0...dev-utils-v3.2.1) (2025-06-18)


### Bug Fixes

* clean up edge functions server ([#310](https://github.com/netlify/primitives/issues/310)) ([243f3b4](https://github.com/netlify/primitives/commit/243f3b472d1350eb6a80d8f736385750de8bc0d4))

## [3.2.0](https://github.com/netlify/primitives/compare/dev-utils-v3.1.1...dev-utils-v3.2.0) (2025-06-06)


### Features

* image cdn support ([#232](https://github.com/netlify/primitives/issues/232)) ([01c844d](https://github.com/netlify/primitives/commit/01c844d82a27a9812be7634219d9bdc69a128985))

## [3.1.1](https://github.com/netlify/primitives/compare/dev-utils-v3.1.0...dev-utils-v3.1.1) (2025-06-03)


### Bug Fixes

* revamp dev and vite plugin logging ([#269](https://github.com/netlify/primitives/issues/269)) ([de9b46c](https://github.com/netlify/primitives/commit/de9b46c1cb1c7b2bf6437ab516134e44203d83b7))

## [3.1.0](https://github.com/netlify/primitives/compare/dev-utils-v3.0.0...dev-utils-v3.1.0) (2025-06-02)


### Features

* add support for edge functions ([#233](https://github.com/netlify/primitives/issues/233)) ([c80d77d](https://github.com/netlify/primitives/commit/c80d77ddf59e394f9d8a84a96275c25c1b9aefc0))


### Bug Fixes

* ensure valid 18.14.0+ dependencies ([#254](https://github.com/netlify/primitives/issues/254)) ([09dd0d8](https://github.com/netlify/primitives/commit/09dd0d8e1ab0c028eee8715b05307d8961b28463))

## [3.0.0](https://github.com/netlify/primitives/compare/dev-utils-v2.2.0...dev-utils-v3.0.0) (2025-05-28)


### ⚠ BREAKING CHANGES

* fix `engines.node` ([#210](https://github.com/netlify/primitives/issues/210))

### Features

* add support for headers config ([#200](https://github.com/netlify/primitives/issues/200)) ([dca313e](https://github.com/netlify/primitives/commit/dca313ec82980231724a2d801bcc739df1d27924))


### Bug Fixes

* **deps:** update dependency @whatwg-node/server to ^0.10.0 ([#214](https://github.com/netlify/primitives/issues/214)) ([b3ea166](https://github.com/netlify/primitives/commit/b3ea1661c63b223f8c0722910ae76ee936f754b4))
* remove unused dependencies, add undeclared dependencies ([#230](https://github.com/netlify/primitives/issues/230)) ([180546a](https://github.com/netlify/primitives/commit/180546aa03b569000ed52cafb07014e9a4c76a1a))


### Build System

* fix `engines.node` ([#210](https://github.com/netlify/primitives/issues/210)) ([5604545](https://github.com/netlify/primitives/commit/56045450d0f6c24988a8956c1946209bda4502bc))

## [2.2.0](https://github.com/netlify/primitives/compare/dev-utils-v2.1.1...dev-utils-v2.2.0) (2025-05-23)


### Features

* add support for environment variables ([#197](https://github.com/netlify/primitives/issues/197)) ([03878db](https://github.com/netlify/primitives/commit/03878dbfff4e7e379b9d3e4fb6d9d783e66cc2af))


### Bug Fixes

* pass route to function invocation ([#202](https://github.com/netlify/primitives/issues/202)) ([7bb9396](https://github.com/netlify/primitives/commit/7bb939649dede2fae6642f724e3491dc598621b6))

## [2.1.1](https://github.com/netlify/primitives/compare/dev-utils-v2.1.0...dev-utils-v2.1.1) (2025-05-09)


### Bug Fixes

* **deps:** update netlify packages ([#153](https://github.com/netlify/primitives/issues/153)) ([1fd1824](https://github.com/netlify/primitives/commit/1fd1824cd9f398921f006b0ccd538f371935d1fa))
* fix package settings and add publint ([#180](https://github.com/netlify/primitives/issues/180)) ([dc093b4](https://github.com/netlify/primitives/commit/dc093b4bece80c79b73981602033e60497f87aa4))

## [2.1.0](https://github.com/netlify/primitives/compare/dev-utils-v2.0.0...dev-utils-v2.1.0) (2025-05-06)


### Features

* add Vite plugin ([#165](https://github.com/netlify/primitives/issues/165)) ([2ec775e](https://github.com/netlify/primitives/commit/2ec775e29be11138f77f8db73e2a3bcfdbe88934))

## [2.0.0](https://github.com/netlify/primitives/compare/dev-utils-v1.1.0...dev-utils-v2.0.0) (2025-05-02)


### ⚠ BREAKING CHANGES

* The `BlobsServer` class now only exports the `start()` and `stop()` methods. This class is not part of the Netlify Blobs client, and it's mostly used internally by Netlify tooling and by some users for integration tests — if you're just using the methods listed in https://docs.netlify.com/blobs/overview/#api-reference, this change does not apply to you and you can safely upgrade.

### Features

* add `runtime` and `runtime-utils` packages ([#150](https://github.com/netlify/primitives/issues/150)) ([be2cbf0](https://github.com/netlify/primitives/commit/be2cbf05cd3b73a795b54f94b7f51dacbcf6ef34))
* add `start` entry point ([#154](https://github.com/netlify/primitives/issues/154)) ([b23c607](https://github.com/netlify/primitives/commit/b23c607ed3aa5e76279efa773b8c6c4d0dee972c))

## [1.1.0](https://github.com/netlify/primitives/compare/dev-utils-v1.0.0...dev-utils-v1.1.0) (2025-04-16)


### Features

* move primitives into monorepo ([#101](https://github.com/netlify/primitives/issues/101)) ([93b72b1](https://github.com/netlify/primitives/commit/93b72b1364022e45cbd87814dc6aa235f1e1c83e))
