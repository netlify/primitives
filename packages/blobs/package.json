{
  "name": "@netlify/blobs",
  "version": "8.2.0",
  "description": "A JavaScript client for the Netlify Blob Store",
  "type": "module",
  "engines": {
    "node": "^14.16.0 || >=16.0.0"
  },
  "main": "./dist/main.cjs",
  "module": "./dist/main.js",
  "types": "./dist/main.d.ts",
  "exports": {
    ".": {
      "require": {
        "types": "./dist/main.d.cts",
        "default": "./dist/main.cjs"
      },
      "import": {
        "types": "./dist/main.d.ts",
        "default": "./dist/main.js"
      },
      "default": {
        "types": "./dist/main.d.ts",
        "default": "./dist/main.js"
      }
    },
    "./package.json": "./package.json",
    "./server": {
      "require": {
        "types": "./dist/server.d.cts",
        "default": "./dist/server.cjs"
      },
      "import": {
        "types": "./dist/server.d.ts",
        "default": "./dist/server.js"
      },
      "default": {
        "types": "./dist/server.d.ts",
        "default": "./dist/server.js"
      }
    }
  },
  "files": [
    "dist/**/*",
    "server.d.ts"
  ],
  "scripts": {
    "build": "tsup-node",
    "dev": "tsup-node --watch",
    "prepack": "npm run build",
    "test": "run-s build test:dev",
    "test:dev": "run-s build test:dev:*",
    "test:ci": "run-s build test:ci:*",
    "test:dev:vitest": "vitest run",
    "test:dev:vitest:watch": "vitest watch",
    "test:ci:vitest": "vitest run"
  },
  "keywords": [],
  "license": "MIT",
  "repository": "netlify/primitives",
  "bugs": {
    "url": "https://github.com/netlify/primitives/issues"
  },
  "author": "Netlify Inc.",
  "directories": {
    "test": "test"
  },
  "devDependencies": {
    "node-fetch": "^3.3.1",
    "semver": "^7.5.3",
    "tmp-promise": "^3.0.3",
    "tsup": "^7.2.0",
    "vitest": "^0.34.0"
  }
}
