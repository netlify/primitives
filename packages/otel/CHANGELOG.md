# Changelog

## [4.3.1](https://github.com/netlify/primitives/compare/otel-v4.3.0...otel-v4.3.1) (2025-10-22)


### Bug Fixes

* export enums by reference instead of as types ([#497](https://github.com/netlify/primitives/issues/497)) ([292304a](https://github.com/netlify/primitives/commit/292304a5536791a8d186f2cbebf8f5f854fbf7db))

## [4.3.0](https://github.com/netlify/primitives/compare/otel-v4.2.0...otel-v4.3.0) (2025-10-10)


### Features

* add trace to otel exports ([#473](https://github.com/netlify/primitives/issues/473)) ([ecc4ec5](https://github.com/netlify/primitives/commit/ecc4ec53e91aef20d1c2009e08582c07f5e01470))

## [4.2.0](https://github.com/netlify/primitives/compare/otel-v4.1.0...otel-v4.2.0) (2025-10-10)


### Features

* Adds W3C trace context propagation to tracer provider ([#471](https://github.com/netlify/primitives/issues/471)) ([afe4656](https://github.com/netlify/primitives/commit/afe4656df5c3bed13ae8c3357205c07efa27c698))

## [4.1.0](https://github.com/netlify/primitives/compare/otel-v4.0.0...otel-v4.1.0) (2025-10-09)


### Features

* extend list of exported otel classes ([#467](https://github.com/netlify/primitives/issues/467)) ([a9b059f](https://github.com/netlify/primitives/commit/a9b059f7ea6ddf8683f520f267a3216c3ab7d9a4))

## [4.0.0](https://github.com/netlify/primitives/compare/otel-v3.4.1...otel-v4.0.0) (2025-09-23)


### ⚠ BREAKING CHANGES

* add `spanProcessors` property ([#460](https://github.com/netlify/primitives/issues/460))

### Features

* add `spanProcessors` property ([#460](https://github.com/netlify/primitives/issues/460)) ([039f955](https://github.com/netlify/primitives/commit/039f955d5de232f7cc1ee57e36a04233b14a2adb))

## [3.4.1](https://github.com/netlify/primitives/compare/otel-v3.4.0...otel-v3.4.1) (2025-08-26)


### Bug Fixes

* don't reüse used request in otel fetch ([#435](https://github.com/netlify/primitives/issues/435)) ([6d755f6](https://github.com/netlify/primitives/commit/6d755f6a081169f5b59b132c03e65bf955debc91))

## [3.4.0](https://github.com/netlify/primitives/compare/otel-v3.3.1...otel-v3.4.0) (2025-08-05)


### Features

* Add skipping and redacting of headers ([#404](https://github.com/netlify/primitives/issues/404)) ([7bcfe6d](https://github.com/netlify/primitives/commit/7bcfe6d636869edbf035da8a815d00a5979044c8))

## [3.3.1](https://github.com/netlify/primitives/compare/otel-v3.3.0...otel-v3.3.1) (2025-07-29)


### Bug Fixes

* Add exporter-netlify and instrumentation-fetch to exports ([#400](https://github.com/netlify/primitives/issues/400)) ([5a6c6f6](https://github.com/netlify/primitives/commit/5a6c6f616f165debe1fe6cff5dbc4a4224327220))

## [3.3.0](https://github.com/netlify/primitives/compare/otel-v3.2.0...otel-v3.3.0) (2025-07-28)


### Features

* a minimal fetch instrumentation ([#383](https://github.com/netlify/primitives/issues/383)) ([744a3a3](https://github.com/netlify/primitives/commit/744a3a39851800fd7220080e7322b8ed38b84391))

## [3.2.0](https://github.com/netlify/primitives/compare/otel-v3.1.0...otel-v3.2.0) (2025-07-24)


### Features

* Add @netlify/otel affordances ([#363](https://github.com/netlify/primitives/issues/363)) ([50fae00](https://github.com/netlify/primitives/commit/50fae00cfae69fcfeed18f24e39f51066cdbcee0))

## [3.1.0](https://github.com/netlify/primitives/compare/otel-v3.0.2...otel-v3.1.0) (2025-07-10)


### Features

* make getTracer a sync function so it can be used in sync and async contexts ([#339](https://github.com/netlify/primitives/issues/339)) ([62e7ede](https://github.com/netlify/primitives/commit/62e7ede177212baaf1939220eba1dc91ac3460b4))

## [3.0.2](https://github.com/netlify/primitives/compare/otel-v3.0.1...otel-v3.0.2) (2025-06-03)


### Bug Fixes

* bring back node 18.14 support by using older version of the @opentelemetry/otlp-transformer package ([#276](https://github.com/netlify/primitives/issues/276)) ([78d156c](https://github.com/netlify/primitives/commit/78d156cdc520a2b53a5d1830b95a4a58cae445f2))

## [3.0.1](https://github.com/netlify/primitives/compare/otel-v3.0.0...otel-v3.0.1) (2025-06-03)


### Bug Fixes

* bring back node18 support by using older versions of the otel packages ([#271](https://github.com/netlify/primitives/issues/271)) ([e8ddc2e](https://github.com/netlify/primitives/commit/e8ddc2e8ed8378d5ca162ed3f681aa9b409db6d1))

## [3.0.0](https://github.com/netlify/primitives/compare/otel-v2.0.0...otel-v3.0.0) (2025-06-02)


### ⚠ BREAKING CHANGES

* drop EOL'd node 18 support in new packages ([#252](https://github.com/netlify/primitives/issues/252))

### Bug Fixes

* drop EOL'd node 18 support in new packages ([#252](https://github.com/netlify/primitives/issues/252)) ([38791ab](https://github.com/netlify/primitives/commit/38791ab91dcbf1f05093ba123eaccdf960a2d6e7))

## [2.0.0](https://github.com/netlify/primitives/compare/otel-v1.1.0...otel-v2.0.0) (2025-05-28)


### ⚠ BREAKING CHANGES

* fix `engines.node` ([#210](https://github.com/netlify/primitives/issues/210))

### Build System

* fix `engines.node` ([#210](https://github.com/netlify/primitives/issues/210)) ([5604545](https://github.com/netlify/primitives/commit/56045450d0f6c24988a8956c1946209bda4502bc))

## [1.1.0](https://github.com/netlify/primitives/compare/otel-v1.0.0...otel-v1.1.0) (2025-05-12)


### Features

* **otel:** initialize OpenTelemetry package with tracer provider and span exporter ([#188](https://github.com/netlify/primitives/issues/188)) ([4056cc4](https://github.com/netlify/primitives/commit/4056cc4d1631ac0b7f94b7aac578a0e7b48defb6))

## Changelog
