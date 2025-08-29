# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands

- `npm install` - Install dependencies for all workspace packages
- `npm run build --workspaces=true` - Build all packages
- `npm run dev` - Start development mode across all packages (uses parallel execution)
- `npm run test --workspaces=true` - Run tests for all packages
- `npm run lint` - Run ESLint with caching
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code using Prettier
- `npm run format:ci` - Check code formatting (CI mode)

### Package-Level Commands

Each package supports consistent commands:

- `npm run build` - Build using tsup
- `npm run dev` - Build in watch mode
- `npm run test` - Run tests (patterns vary by package)
- `npm run test:dev` - Interactive test runner
- `npm run test:ci` - CI test execution
- `npm run publint` - Package publication validation

### Testing Patterns

- **Comprehensive packages** (blobs, cache, otel): Use `run-s` for sequential build+test
- **Simple packages** (edge-functions, dev, vite-plugin): Direct vitest execution
- **Types package**: Includes TypeScript type checking with `tsc --noEmit`
- **Functions package**: Includes `tsd` for TypeScript type testing

## Architecture Overview

### Monorepo Structure

This is a **Netlify Primitives** monorepo with 20 packages organized in layers:

1. **Foundation Layer**: `types`, `runtime-utils`, `dev-utils`
2. **Platform Primitives**: `blobs`, `cache`, `functions`, `edge-functions`, `headers`, `images`, `redirects`, `static`,
   `otel`
3. **Runtime Layer**: `runtime`, `dev`
4. **Integration Layer**: `vite-plugin`

### Key Design Patterns

#### Context-Driven Architecture

All primitives use a unified `Context` interface that provides:

- Account, site, and deployment information
- Request/response utilities (`json`, `next`, `waitUntil`)
- Environment data (`geo`, `ip`, `cookies`)
- Logging and observability

#### Global Environment Pattern

Runtime uses `global.Netlify` object for platform API access. Check `packages/runtime/src/lib/globals.ts` for the global
interface.

#### Dual-Mode Architecture

Packages support both:

- **Runtime mode**: Lightweight production utilities
- **Development mode**: Full local emulation with filesystem watching

#### Handler Chain for Development

Development server processes requests through: Edge Functions → Images → Functions → Redirects → Static Files

### Build System

- **TypeScript**: Modern config with `NodeNext` module resolution and `esnext` target
- **Bundler**: `tsup` for fast, zero-config bundling
- **Exports**: Dual CJS/ESM support with proper TypeScript declarations
- **Parallel execution**: Custom script at `scripts/parallel.js` for running commands across packages

### Development Experience

- **Vite Plugin**: Transparent proxy that integrates Netlify primitives into Vite development
- **Feature toggles**: Granular control over which primitives are enabled
- **Local parity**: Complete platform emulation without cloud connectivity

### Observability

Built-in OpenTelemetry support via `@netlify/otel` package. Use `getTracer()` for distributed tracing across primitives.

### Key Files

- `packages/types/src/lib/context/context.ts` - Core Context interface
- `packages/runtime/src/lib/globals.ts` - Global environment setup
- `packages/dev/src/main.ts` - Development server handler chain
- `packages/vite-plugin/src/main.ts` - Vite integration middleware

## Working with This Codebase

### Common Patterns

- All packages follow strict TypeScript configuration
- Consistent export patterns for dual module support
- Test files use `.test.ts` extension with vitest
- Build artifacts go to `dist/` directory
- Source code in `src/` directory

### Dependencies

- **deno**: Required for Edge Functions (version 2.2.4)
- **playwright**: For browser testing (vite-plugin package)
- **vitest**: Primary testing framework
- **tsup**: Build tool for all packages

### Development Workflow

1. Run `npm install` to install all dependencies
2. Use `npm run dev` to start development mode
3. Run tests with `npm run test --workspaces=true`
4. Build with `npm run build --workspaces=true`
5. Lint with `npm run lint`
