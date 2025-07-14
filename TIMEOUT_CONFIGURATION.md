# Timeout Configuration

This document describes the timeout configuration functionality available in the Netlify primitives packages.

## Overview

The timeout functionality is split across two packages:

- `@netlify/types` - TypeScript interfaces and types for timeout configurations
- `@netlify/dev-utils` - Timeout constants, utilities, and functions

## Types (@netlify/types)

### TimeoutConfig

Main configuration interface for all timeout settings:

```typescript
interface TimeoutConfig {
  functionSync: number        // Default timeout for synchronous functions (seconds)
  functionBackground: number  // Default timeout for background functions (seconds)
  deploy: number             // Default timeout for deployments (milliseconds)
  frameworkServer: number    // Default timeout for framework server startup (milliseconds)
  frameworkServerWarn: number // Warning timeout for framework server startup (milliseconds)
  httpAgent: number          // Timeout for HTTP agent connections (seconds)
  geoLocation: number        // Timeout for geo-location requests (milliseconds)
}
```

### FunctionTimeoutConfig

Configuration for function-specific timeouts:

```typescript
interface FunctionTimeoutConfig {
  functionsTimeout?: number     // Site-specific function timeout (seconds)
  functionsConfig?: {
    timeout?: number            // Function-specific timeout configuration (seconds)
  }
}
```

### DeployTimeoutOptions

Options for deployment timeouts:

```typescript
interface DeployTimeoutOptions {
  timeout?: number              // Custom timeout for deployment (milliseconds)
}
```

### TunnelTimeoutConfig

Configuration for live tunnel timeouts:

```typescript
interface TunnelTimeoutConfig {
  pollTimeout: number           // Timeout for live tunnel polling
}
```

## Constants and Utilities (@netlify/dev-utils)

### Default Timeout Constants

```typescript
import { DEFAULT_TIMEOUTS } from '@netlify/dev-utils'

// Access all default timeouts
console.log(DEFAULT_TIMEOUTS.functionSync)      // 30 seconds
console.log(DEFAULT_TIMEOUTS.functionBackground) // 900 seconds
console.log(DEFAULT_TIMEOUTS.deploy)            // 1,200,000 ms (20 minutes)
```

### Individual Constants

```typescript
import {
  SYNCHRONOUS_FUNCTION_TIMEOUT,    // 30 seconds
  BACKGROUND_FUNCTION_TIMEOUT,     // 900 seconds
  DEFAULT_DEPLOY_TIMEOUT,          // 1,200,000 ms
  FRAMEWORK_PORT_TIMEOUT_MS,       // 600,000 ms (10 minutes)
  FRAMEWORK_PORT_WARN_TIMEOUT_MS,  // 5,000 ms (5 seconds)
  AGENT_PORT_TIMEOUT,              // 50 seconds
  REQUEST_TIMEOUT,                 // 10,000 ms (10 seconds)
} from '@netlify/dev-utils'
```

### Utility Functions

#### getFunctionTimeout

Get the effective function timeout considering site-specific configuration:

```typescript
import { getFunctionTimeout } from '@netlify/dev-utils'

// For synchronous functions
const syncTimeout = getFunctionTimeout({})  // Returns 30 seconds

// For background functions
const bgTimeout = getFunctionTimeout({}, true)  // Returns 900 seconds

// With site-specific configuration
const siteTimeout = getFunctionTimeout({
  functionsTimeout: 60
})  // Returns 60 seconds
```

#### getDeployTimeout

Get the effective deploy timeout considering custom options:

```typescript
import { getDeployTimeout } from '@netlify/dev-utils'

// Default timeout
const defaultTimeout = getDeployTimeout()  // Returns 1,200,000 ms

// Custom timeout
const customTimeout = getDeployTimeout({ timeout: 600_000 })  // Returns 600,000 ms
```

#### createTimeoutConfig

Create a timeout configuration with custom overrides:

```typescript
import { createTimeoutConfig } from '@netlify/dev-utils'

// Default configuration
const defaultConfig = createTimeoutConfig()

// Custom configuration
const customConfig = createTimeoutConfig({
  functionSync: 45,
  deploy: 800_000
})
```

#### Time Conversion Utilities

```typescript
import { secondsToMs, msToSeconds } from '@netlify/dev-utils'

const milliseconds = secondsToMs(30)    // Returns 30000
const seconds = msToSeconds(30000)      // Returns 30
```

## Usage in netlify/cli

These timeout configurations can be imported and used in netlify/cli to replace the existing timeout constants:

```typescript
// Replace existing constants
import {
  SYNCHRONOUS_FUNCTION_TIMEOUT,
  BACKGROUND_FUNCTION_TIMEOUT,
  DEFAULT_DEPLOY_TIMEOUT,
  FRAMEWORK_PORT_TIMEOUT_MS,
  FRAMEWORK_PORT_WARN_TIMEOUT_MS,
  AGENT_PORT_TIMEOUT,
  REQUEST_TIMEOUT,
  getFunctionTimeout,
  getDeployTimeout,
} from '@netlify/dev-utils'

// Use in function timeout logic
const effectiveTimeout = getFunctionTimeout(siteInfo, isBackground)

// Use in deploy command
const deployTimeout = getDeployTimeout(options)
```

## Backward Compatibility

All existing timeout values and behavior are preserved. The new timeout functionality provides:

- Same default timeout values as before
- Utilities that respect site-specific configuration
- Proper TypeScript types
- Centralized timeout management

The timeout constants match the values from netlify/cli:
- `SYNCHRONOUS_FUNCTION_TIMEOUT = 30` (from `src/utils/dev.ts`)
- `BACKGROUND_FUNCTION_TIMEOUT = 900` (from `src/utils/dev.ts`)
- `DEFAULT_DEPLOY_TIMEOUT = 1_200_000` (from `src/utils/deploy/constants.ts`)
- `FRAMEWORK_PORT_TIMEOUT_MS = 10 * 60 * 1000` (from `src/utils/framework-server.ts`)
- `FRAMEWORK_PORT_WARN_TIMEOUT_MS = 5 * 1000` (from `src/utils/framework-server.ts`)
- `AGENT_PORT_TIMEOUT = 50` (from `src/lib/http-agent.ts`)
- `REQUEST_TIMEOUT = 10000` (from `src/lib/geo-location.ts`)