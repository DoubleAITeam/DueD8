# Developer Guide

Welcome to the Deliverables codebase. This guide walks new contributors through the tooling expectations, project layout, and the conventions used for adapters, IPC bridges, and testing.

## Prerequisites

- **Node.js:** 20.x LTS is the reference runtime. Earlier versions may lack the filesystem APIs used by the CLI wrappers.
- **npm:** 10.x bundled with Node 20.
- **Electron:** The repo pins Electron `28.3.x`. Use the matching major version when running external tooling or debugging native APIs.

Install dependencies with `npm install` and keep `node_modules` committed out of source control.

## Project layout

```
electron/
  deliverables/
    archive.ts          # ZIP builder and archive retention helpers.
    config/             # Environment validation and feature-flag plumbing.
    dataStore.ts        # Run + summary persistence backed by JSON files.
    insights/           # Artifact parsing, redaction, and AI augmentations.
    jobs/               # Discrete worker jobs (validation, rendering).
    pipeline.ts         # Orchestrates adapters, post-processing, and logging.
    postprocess/        # Rule engine and filesystem safeguards.
    renderers/          # Adapter implementations for html/docx/pdf.
    report.ts           # Summary report writer.
    retention.ts        # Output sweeping and archive rotation logic.
    utils/              # Shared helpers (retry, filesystem, tooling).
  main.ts               # Electron entry point.
  preload.ts            # IPC bridge definitions exposed to the renderer.

src/
  renderer/             # React front-end and Zustand stores.

scripts/
  generateDocs.ts       # API documentation generator (TypeScript compiler API).
  updateChangelog.ts    # Appends release metadata to the changelog.

tests/
  deliverables/         # Vitest unit coverage for pipeline modules.
  e2e/                  # Smoke harness that spawns Electron headlessly.
```

## Onboarding workflow

1. Clone the repository and install dependencies.
2. Run `npm run docs:api` once to ensure compiler tooling is available.
3. Launch `npm run dev` to verify the renderer and main process build correctly.
4. Execute `npm run test` (unit + smoke) before starting feature work to confirm a clean baseline.

## Extending the pipeline

### Creating a new adapter

1. Start with `electron/deliverables/renderers/adapter.ts` to understand the required shape.
2. Copy an existing adapter (e.g. `staticHtmlAdapter`) into a new module.
3. Register it in `electron/deliverables/pipeline.ts` via `registerAdapter`.
4. Add a Vitest health test under `tests/deliverables` that toggles the relevant feature flag and asserts the adapter returns a healthy status.
5. Include a smoke assertion in `tests/e2e/smoke.test.ts` if the adapter introduces new filesystem output formats.

### Extending IPC safely

- Define new channels in `electron/deliverables/ipc.ts` using descriptive namespaced keys (`deliverables:<action>`).
- Validate inputs defensively—coerce types, strip unexpected fields, and return structured `{ ok, message }` payloads.
- Mirror the IPC surface in `electron/preload.ts` and `src/types/index.d.ts` to keep renderer type safety intact.
- Update the doc generator (`npm run docs:api`) so `docs/API_REFERENCE.md` reflects the new API surface automatically.

### Automation helpers

- CLI subcommands live in `electron/deliverables/cli.ts` and wrap existing pipeline helpers. Keep output JSON-serialisable for scripting.
- `bin/deliverables.js` registers ts-node and proxies arguments to the TypeScript CLI implementation. Accept `--help` friendly messages and exit non-zero on failure.

## Testing philosophy

- **Unit tests:** `vitest` covers adapters, IPC handlers, and config parsing. Aim for >80% coverage in `tests/deliverables` before merging significant changes.
- **Smoke tests:** `npm run test:smoke` spawns the Electron runtime in headless mode to ensure pipelines, summaries, insights, and archives function end-to-end. Keep the test deterministic by pinning temp directories and using dry-run adapters.
- **Type safety:** `npm run typecheck:deliverables` gates strongly typed modules. The stricter `npm run typecheck:strict` adds additional compiler checks before releases.
- **Linting:** `npm run lint` enforces the shared ESLint configuration with `@typescript-eslint` rules, including `no-floating-promises` and explicit module boundaries.

## Local tooling shortcuts

- `npm run deliverables:run -- --artifacts ./path/to/manifest.json` executes a one-off pipeline run.
- `npm run docs:api` regenerates the API reference from TypeScript definitions.
- `npm run ci:deliverables` runs linting, strict type checks, and the smoke harness—use this before opening a pull request.

Stay disciplined about regenerating docs (`docs:api`) and updating `docs/CHANGELOG.md` with `npm version` to keep downstream operators informed.
