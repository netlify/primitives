# Changelog

## [8.1.0](https://github.com/netlify/blobs/compare/v8.0.1...v8.1.0) (2024-10-11)


### Features

* **types:** export deploy factory options types ([#196](https://github.com/netlify/blobs/issues/196)) ([29893cb](https://github.com/netlify/blobs/commit/29893cb00f4052f5171f7551711f31d495342cd8))


### Bug Fixes

* add more actionable info for missing primaryRegion ([#195](https://github.com/netlify/blobs/issues/195)) ([dd517dc](https://github.com/netlify/blobs/commit/dd517dcf74f1649adadbf7c652e924fcdf065e24))

## [8.0.1](https://github.com/netlify/blobs/compare/v8.0.0...v8.0.1) (2024-08-19)


### Bug Fixes

* 404ing list results should return empty iterators, not throw ([#189](https://github.com/netlify/blobs/issues/189)) ([1da860d](https://github.com/netlify/blobs/commit/1da860dcc54cd33dddddcd8a78ea2f68a1cf523e))

## [8.0.0](https://github.com/netlify/blobs/compare/v7.4.0...v8.0.0) (2024-07-03)


### ⚠ BREAKING CHANGES

* add region parameter ([#183](https://github.com/netlify/blobs/issues/183))

### Features

* add region parameter ([#183](https://github.com/netlify/blobs/issues/183)) ([03187bb](https://github.com/netlify/blobs/commit/03187bb2b5b0a8d6ce1e823f811f168b05635886))

## [7.4.0](https://github.com/netlify/blobs/compare/v7.3.0...v7.4.0) (2024-07-01)


### Features

* support named deploy-scoped stores ([#181](https://github.com/netlify/blobs/issues/181)) ([7b24ef8](https://github.com/netlify/blobs/commit/7b24ef82756f53be89cc22c9ce8dbe1bd66468dc))

## [7.3.0](https://github.com/netlify/blobs/compare/v7.2.0...v7.3.0) (2024-04-03)


### Features

* add details to error message ([#167](https://github.com/netlify/blobs/issues/167)) ([7367241](https://github.com/netlify/blobs/commit/7367241451dab9be423aa0ca16dae51e827e0f57))
* add request ID to error messages ([#165](https://github.com/netlify/blobs/issues/165)) ([b560051](https://github.com/netlify/blobs/commit/b5600511faa9503478662c68699996f708eb7b43))
* handle `region:` prefix in local server ([#164](https://github.com/netlify/blobs/issues/164)) ([fe7d899](https://github.com/netlify/blobs/commit/fe7d89953f369fbe90c911c527d118b655b30b3c))

## [7.2.0](https://github.com/netlify/blobs/compare/v7.1.0...v7.2.0) (2024-04-01)


### Features

* add `url` to server's `onRequest` callback ([#162](https://github.com/netlify/blobs/issues/162)) ([89f5ce4](https://github.com/netlify/blobs/commit/89f5ce4c270d018cf3475faa9920e46ff8cf8860))
* export `setEnvironmentContext()` ([#160](https://github.com/netlify/blobs/issues/160)) ([90a0412](https://github.com/netlify/blobs/commit/90a0412a2d2b7b7f5113460ca00610dd40c01f76))

## [7.1.0](https://github.com/netlify/blobs/compare/v7.0.1...v7.1.0) (2024-04-01)


### Features

* add experimental support for region selection ([#158](https://github.com/netlify/blobs/issues/158)) ([6734751](https://github.com/netlify/blobs/commit/673475135a98c4e4b0b98d7a5cc5b26ed813d16c))

## [7.0.1](https://github.com/netlify/blobs/compare/v7.0.0...v7.0.1) (2024-03-08)


### Bug Fixes

* include connectLambda in dist ([#156](https://github.com/netlify/blobs/issues/156)) ([f7963b8](https://github.com/netlify/blobs/commit/f7963b8af00d6ca1e42650116c8cc27618996fd5))

## [7.0.0](https://github.com/netlify/blobs/compare/v6.5.0...v7.0.0) (2024-03-06)


### ⚠ BREAKING CHANGES

* move server to sub-module export ([#155](https://github.com/netlify/blobs/issues/155))
* add `listStores` method ([#149](https://github.com/netlify/blobs/issues/149))

### Features

* add `listStores` method ([#149](https://github.com/netlify/blobs/issues/149)) ([3d0a386](https://github.com/netlify/blobs/commit/3d0a386f4ad6a5fe4a19c4e8b8bbef73ddb557a2))
* allow internal access to legacy stores ([#152](https://github.com/netlify/blobs/issues/152)) ([1b712fe](https://github.com/netlify/blobs/commit/1b712fe52be74e0286bad6bb8d5972ea6a45b4ba))
* move server to sub-module export ([#155](https://github.com/netlify/blobs/issues/155)) ([4bcfeff](https://github.com/netlify/blobs/commit/4bcfeff5288e1bf0934730bb4c40f3e38ba51892))
* remove usage of Node built-ins ([#154](https://github.com/netlify/blobs/issues/154)) ([3148833](https://github.com/netlify/blobs/commit/3148833e6e87472fe3252127862b0a8e87e349d6))
* respect `accept` header in server ([#153](https://github.com/netlify/blobs/issues/153)) ([8259e5e](https://github.com/netlify/blobs/commit/8259e5e7c7b96b9d9db9ff5e8e126f3b6b137d53))
* support listing stores in local server ([#151](https://github.com/netlify/blobs/issues/151)) ([8820cc8](https://github.com/netlify/blobs/commit/8820cc81322ad1ea29d4b7c3061e57560e26ef02))
* use `accept` header for signed URL ([#150](https://github.com/netlify/blobs/issues/150)) ([713e2be](https://github.com/netlify/blobs/commit/713e2bef0e105685ccb39604f5fc9c51df85865d))
* use new API endpoints ([#147](https://github.com/netlify/blobs/issues/147)) ([5ad27eb](https://github.com/netlify/blobs/commit/5ad27ebd6da7dba6264eb2fc5db16bc8aca5d7ba))

## [6.5.0](https://github.com/netlify/blobs/compare/v6.4.2...v6.5.0) (2024-02-08)


### Features

* add `consistency` configuration property ([#143](https://github.com/netlify/blobs/issues/143)) ([febd736](https://github.com/netlify/blobs/commit/febd736b6e4f7760f9b09f663348cce7c478335e))

## [6.4.2](https://github.com/netlify/blobs/compare/v6.4.1...v6.4.2) (2024-01-15)


### Bug Fixes

* simplify streaming of server writes ([#137](https://github.com/netlify/blobs/issues/137)) ([ae5bdf9](https://github.com/netlify/blobs/commit/ae5bdf9637a6bf1a8eaa08aabdd7ada77b63c7e0))

## [6.4.1](https://github.com/netlify/blobs/compare/v6.4.0...v6.4.1) (2024-01-11)


### Bug Fixes

* disallow empty key ([#134](https://github.com/netlify/blobs/issues/134)) ([a8b4a23](https://github.com/netlify/blobs/commit/a8b4a23b8414dceb8cc623e511f623ab72cd06ad))

## [6.4.0](https://github.com/netlify/blobs/compare/v6.3.1...v6.4.0) (2024-01-09)


### Features

* add `connectLambda` method ([#128](https://github.com/netlify/blobs/issues/128)) ([d1061b4](https://github.com/netlify/blobs/commit/d1061b4e559865557f1ebc758e09a4ac35ade209))


### Bug Fixes

* copy temp file to prevent `EXDEV: cross-device link not permitted` ([#132](https://github.com/netlify/blobs/issues/132)) ([61b4ee6](https://github.com/netlify/blobs/commit/61b4ee668381dbf7e83179f93cd42a20f412b892))

## [6.3.1](https://github.com/netlify/blobs/compare/v6.3.0...v6.3.1) (2023-11-24)


### Bug Fixes

* handle deploy-scoped stores on Windows ([#119](https://github.com/netlify/blobs/issues/119)) ([e96286d](https://github.com/netlify/blobs/commit/e96286d5d0182e99bc7ec2a6f440bf44f1cb347b))

## [6.3.0](https://github.com/netlify/blobs/compare/v6.2.0...v6.3.0) (2023-11-16)


### Features

* add `onRequest` callback to server ([#116](https://github.com/netlify/blobs/issues/116)) ([35629fd](https://github.com/netlify/blobs/commit/35629fd81a434be24d2248516593dcbe1fbdccb7))


### Bug Fixes

* stop logging metadata not found error ([#114](https://github.com/netlify/blobs/issues/114)) ([0fb9ab6](https://github.com/netlify/blobs/commit/0fb9ab650b7bdfcb7b25c4a0ff706f8e20e44ad8))

## [6.2.0](https://github.com/netlify/blobs/compare/v6.1.0...v6.2.0) (2023-11-14)


### Features

* export Store types ([#110](https://github.com/netlify/blobs/issues/110)) ([f04eaa5](https://github.com/netlify/blobs/commit/f04eaa566ef2ebc95328d1d54d4e8222e7b6eb5d))


### Bug Fixes

* fix metadata in local server ([#112](https://github.com/netlify/blobs/issues/112)) ([9646519](https://github.com/netlify/blobs/commit/96465198a790c2c3acf9b4569cc05928126ee0be))

## [6.1.0](https://github.com/netlify/blobs/compare/v6.0.1...v6.1.0) (2023-11-14)


### Features

* support API access in local server ([#108](https://github.com/netlify/blobs/issues/108)) ([bea8874](https://github.com/netlify/blobs/commit/bea88742cdd868ef797ef88bf63fec778307d504))
* support HEAD requests in local server ([#109](https://github.com/netlify/blobs/issues/109)) ([25ff62c](https://github.com/netlify/blobs/commit/25ff62c054c3fe6f223abd8523ae1af8d76295f3))


### Bug Fixes

* update repo url in package.json ([#106](https://github.com/netlify/blobs/issues/106)) ([84e4e58](https://github.com/netlify/blobs/commit/84e4e58d06dd4d890e10a1e41285fbc567194ae5))

## [6.0.1](https://github.com/netlify/blobs/compare/v6.0.0...v6.0.1) (2023-11-13)


### Bug Fixes

* successful delete returns 204 ([#104](https://github.com/netlify/blobs/issues/104)) ([da0ea31](https://github.com/netlify/blobs/commit/da0ea3145489d2cb93fdeb32be6db33af6049869))

## [6.0.0](https://github.com/netlify/blobs/compare/v5.0.0...v6.0.0) (2023-11-10)


### ⚠ BREAKING CHANGES

* return `AsyncIterator` for `list()` ([#102](https://github.com/netlify/blobs/issues/102))

### Features

* return `AsyncIterator` for `list()` ([#102](https://github.com/netlify/blobs/issues/102)) ([f951513](https://github.com/netlify/blobs/commit/f951513a33d0009e863752e95d801486c410c4d7))

## [5.0.0](https://github.com/netlify/blobs/compare/v4.2.0...v5.0.0) (2023-11-09)


### ⚠ BREAKING CHANGES

* remove `fresh` property from metadata result ([#99](https://github.com/netlify/blobs/issues/99))
* return boolean from `delete()` ([#98](https://github.com/netlify/blobs/issues/98))
* disallow setting an object as a stream ([#96](https://github.com/netlify/blobs/issues/96))

### Features

* disallow setting an object as a stream ([#96](https://github.com/netlify/blobs/issues/96)) ([1c8f668](https://github.com/netlify/blobs/commit/1c8f668e27210c92a564efb45a3ae6bc7a0c518b))
* remove `fresh` property from metadata result ([#99](https://github.com/netlify/blobs/issues/99)) ([a0f337a](https://github.com/netlify/blobs/commit/a0f337a81a30c19804737da6ea62f67dd015ca6c))
* remove return value of `delete()` ([#100](https://github.com/netlify/blobs/issues/100)) ([b0c607b](https://github.com/netlify/blobs/commit/b0c607b1c4742f2f4d32b709c1df5ee4cb14d383))
* return boolean from `delete()` ([#98](https://github.com/netlify/blobs/issues/98)) ([a566287](https://github.com/netlify/blobs/commit/a566287619a97a3ce146768225284fecc0910be2))

## [4.2.0](https://github.com/netlify/blobs/compare/v4.1.0...v4.2.0) (2023-11-07)


### Features

* add `getMetadata` method ([#90](https://github.com/netlify/blobs/issues/90)) ([0327476](https://github.com/netlify/blobs/commit/03274763dc0afc9fdbe3981685f8eba1882bae4a))


### Bug Fixes

* delete status code checking ([#93](https://github.com/netlify/blobs/issues/93)) ([ea3d754](https://github.com/netlify/blobs/commit/ea3d754fb918b25490c6b924806a3bf8ae378120))
* internal vs external metadata headers ([#92](https://github.com/netlify/blobs/issues/92)) ([de41f9e](https://github.com/netlify/blobs/commit/de41f9e6e59a50426338f504270a6b37aa8e3904))

## [4.1.0](https://github.com/netlify/blobs/compare/v4.0.0...v4.1.0) (2023-11-02)


### Features

* load context from global variable ([#87](https://github.com/netlify/blobs/issues/87)) ([cbb5c3d](https://github.com/netlify/blobs/commit/cbb5c3d3fb92d2680865831926d11af8a9ac2103))

## [4.0.0](https://github.com/netlify/blobs/compare/v3.3.0...v4.0.0) (2023-10-26)


### ⚠ BREAKING CHANGES

* validate keys and store names ([#80](https://github.com/netlify/blobs/issues/80))

### Features

* add `list()` method ([#82](https://github.com/netlify/blobs/issues/82)) ([00db5ff](https://github.com/netlify/blobs/commit/00db5ff2cfb1e1780eadd4f1605f76f6519f65d2))
* support `list()` in local server ([#83](https://github.com/netlify/blobs/issues/83)) ([9fc8456](https://github.com/netlify/blobs/commit/9fc845604fc20189a18fff5add075d542fbddc8e))
* update validation rules ([#84](https://github.com/netlify/blobs/issues/84)) ([7218bb5](https://github.com/netlify/blobs/commit/7218bb5865770f7a83967613c378d4b7bed9df3c))
* validate keys and store names ([#80](https://github.com/netlify/blobs/issues/80)) ([af867f8](https://github.com/netlify/blobs/commit/af867f87225f2c1e10192d3a4403b76d49c6cb56))

## [3.3.0](https://github.com/netlify/blobs/compare/v3.2.0...v3.3.0) (2023-10-23)


### Features

* add local server ([#75](https://github.com/netlify/blobs/issues/75)) ([dc209d7](https://github.com/netlify/blobs/commit/dc209d715ca87d3b774784fde3cf02ce0e3b0faf))
* add support for conditional requests ([#76](https://github.com/netlify/blobs/issues/76)) ([82df6ad](https://github.com/netlify/blobs/commit/82df6ad0889ea29fd6191133c8a319e7e458ab7d))
* encode store name + check for `fetch` ([#73](https://github.com/netlify/blobs/issues/73)) ([0cb0b36](https://github.com/netlify/blobs/commit/0cb0b3654b164e327e9602ad229bfdd69f0cab45))

## [3.2.0](https://github.com/netlify/blobs/compare/v3.1.0...v3.2.0) (2023-10-19)


### Features

* add support for arbitrary metadata ([#70](https://github.com/netlify/blobs/issues/70)) ([9b2a4df](https://github.com/netlify/blobs/commit/9b2a4dfe2adbb028c5cbfbe814e53e010a58be19))


### Bug Fixes

* couple of small fixes ([#72](https://github.com/netlify/blobs/issues/72)) ([edadf1c](https://github.com/netlify/blobs/commit/edadf1c6288ae0c55e48cc196e2476e3ef95cc0c))

## [3.1.0](https://github.com/netlify/blobs/compare/v3.0.0...v3.1.0) (2023-10-18)


### Features

* add `getDeployStore` method ([#68](https://github.com/netlify/blobs/issues/68)) ([5135f3d](https://github.com/netlify/blobs/commit/5135f3d3dfaf55c48c51e8b115ab64c8728e73aa))

## [3.0.0](https://github.com/netlify/blobs/compare/v2.2.0...v3.0.0) (2023-10-17)


### ⚠ BREAKING CHANGES

* add `getStore` method ([#58](https://github.com/netlify/blobs/issues/58))

### Features

* add `getStore` method ([#58](https://github.com/netlify/blobs/issues/58)) ([6507e87](https://github.com/netlify/blobs/commit/6507e87cdebe110b6e5145c7c69f3c1a16b066ee))

## [2.2.0](https://github.com/netlify/blobs/compare/v2.1.1...v2.2.0) (2023-10-13)


### Features

* add package.json to export map ([#64](https://github.com/netlify/blobs/issues/64)) ([3ea080e](https://github.com/netlify/blobs/commit/3ea080e9cdde95f14b8d372181be78b208727d0b))

## [2.1.1](https://github.com/netlify/blobs/compare/v2.1.0...v2.1.1) (2023-10-13)


### Bug Fixes

* adjust export map to be actually importable ([#62](https://github.com/netlify/blobs/issues/62)) ([1bedfde](https://github.com/netlify/blobs/commit/1bedfde6c5ddb368b5789bc1766f7918eac19a8f))

## [2.1.0](https://github.com/netlify/blobs/compare/v2.0.0...v2.1.0) (2023-10-11)


### Features

* export commonjs and esm from package ([#59](https://github.com/netlify/blobs/issues/59)) ([38b9c81](https://github.com/netlify/blobs/commit/38b9c81c280a2bc3b7a348103d94b98fd44f67e9))

## [2.0.0](https://github.com/netlify/blobs/compare/v1.6.1...v2.0.0) (2023-09-25)


### ⚠ BREAKING CHANGES

* use URI-encoded keys ([#50](https://github.com/netlify/blobs/issues/50))

### Features

* use URI-encoded keys ([#50](https://github.com/netlify/blobs/issues/50)) ([fd8e1c6](https://github.com/netlify/blobs/commit/fd8e1c6b0f30714e0e0649a22b0b615bc48dbabe))

## [1.6.1](https://github.com/netlify/blobs/compare/v1.6.0...v1.6.1) (2023-09-21)


### Bug Fixes

* workaround for a cloudfront issue where it throws on a 403 ([c0fd160](https://github.com/netlify/blobs/commit/c0fd160d49c95205b577b031e3b3aee622e003af))

## [1.6.0](https://github.com/netlify/blobs/compare/v1.5.0...v1.6.0) (2023-07-31)


### Features

* add `setFiles()` method ([#28](https://github.com/netlify/blobs/issues/28)) ([fd769de](https://github.com/netlify/blobs/commit/fd769dec65a215bf3de74dcf279ab2484e4f3a70))


### Bug Fixes

* **deps:** update dependency esbuild to v0.18.17 ([ad0d7e3](https://github.com/netlify/blobs/commit/ad0d7e3b2757dabad1c1e43e2f9a912317b72d8f))

## [1.5.0](https://github.com/netlify/blobs/compare/v1.4.0...v1.5.0) (2023-07-27)


### Features

* add `setFile()` method ([#26](https://github.com/netlify/blobs/issues/26)) ([b8dc848](https://github.com/netlify/blobs/commit/b8dc848aa74adc3c8d37314a0b6c00a4e2c0e28a))
* add retry logic ([#27](https://github.com/netlify/blobs/issues/27)) ([c824f0d](https://github.com/netlify/blobs/commit/c824f0d6db06b87bed9e9509ca0301d72d307b67))
* build with esbuild ([#22](https://github.com/netlify/blobs/issues/22)) ([23c6576](https://github.com/netlify/blobs/commit/23c6576dd336c0d87fbc32608c30fbcbd625139f))
* update `get` signature ([#23](https://github.com/netlify/blobs/issues/23)) ([e817d59](https://github.com/netlify/blobs/commit/e817d590c1bea56925147571aa1506988fee9905))

## [1.4.0](https://github.com/netlify/blobs/compare/v1.3.0...v1.4.0) (2023-07-20)


### Features

* support TTL in `setJSON` method ([#17](https://github.com/netlify/blobs/issues/17)) ([392c9e1](https://github.com/netlify/blobs/commit/392c9e1cb00ae32622d32e36c06475706a9bcdf0))

## [1.3.0](https://github.com/netlify/blobs/compare/v1.2.0...v1.3.0) (2023-07-19)


### Features

* throw error on missing config properties ([#15](https://github.com/netlify/blobs/issues/15)) ([10f30a8](https://github.com/netlify/blobs/commit/10f30a89ee3c8614b3a7f8a06a4a4672b9c83937))

## [1.2.0](https://github.com/netlify/blobs/compare/v1.1.0...v1.2.0) (2023-07-18)


### Miscellaneous Chores

* release 1.2.0 ([88173ae](https://github.com/netlify/blobs/commit/88173aeaba04cc90c3a9b9c47fc4fbc7e2f2a99c))

## [1.1.0](https://github.com/netlify/blobs/compare/v1.0.0...v1.1.0) (2023-07-18)


### Features

* throw when API returns an error code ([#12](https://github.com/netlify/blobs/issues/12)) ([a6573b2](https://github.com/netlify/blobs/commit/a6573b2acb218e9bb12cdde3b1a83d64214aa864))

## 1.0.0 (2023-07-18)


### Features

* return `null` on 404 ([614e214](https://github.com/netlify/blobs/commit/614e21463f55c13a30462f3c575acdfa0a5ba299))
* update `get` signature ([33b774c](https://github.com/netlify/blobs/commit/33b774c49aadfbc99391d96b357c27e69a4a4e93))
* various small updates ([#10](https://github.com/netlify/blobs/issues/10)) ([30e9d4b](https://github.com/netlify/blobs/commit/30e9d4b999b559cccb342db5a511ef1f54a5aadd))


### Bug Fixes

* fix linting problems ([4cceed2](https://github.com/netlify/blobs/commit/4cceed26784deac5865b1c9f2234b549f0c613d7))
