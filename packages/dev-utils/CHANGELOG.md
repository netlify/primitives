# Changelog

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
