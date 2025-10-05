# DueD8

DueD8 is an Electron, Vite, and React desktop app that connects to Canvas LMS to surface upcoming work in a clean dashboard. The
app securely stores a Canvas personal access token, validates it from the main process, and renders profile, course, assignment,
and calendar information for the next two weeks.

## Requirements
- Node.js 18.x
- npm 9.x

## Setup
```bash
npm install
```

## Development workflow
```bash
npm run dev
```

This command will:
1. Build the Electron main and preload bundles into `dist-electron`.
2. Start the Vite renderer on port 5173.
3. Wait for both bundles and the dev server to be ready.
4. Launch Electron automatically pointed at the Vite dev server (no manual browser step required).

If the window does not appear, review the terminal for messages beginning with `[main]` or `[renderer]` for diagnostics.

## Connecting to Canvas
1. Log in to Canvas in your browser.
2. Navigate to **Account → Settings** and click **New Access Token**.
3. Give the token a short, descriptive name and (optionally) an expiry date.
4. Copy the generated token immediately—Canvas will not show it again.
5. Launch DueD8 and paste the token into the **Connect to Canvas** screen, then click **Save & Test**.

Tokens are stored using the system keychain through `keytar` when available. If the platform keychain is unavailable the token is
encrypted with AES-256-GCM and saved inside the Electron `userData` directory. Tokens are never written to logs and are only used
inside the Electron main process.

## Data fetching design
All Canvas network calls originate in the Electron main process. The renderer uses typed IPC helpers exposed on
`window.dued8.canvas` to invoke requests. The main process tries Canvas hosts in the following order and stops on the first
successful (2xx) response:
1. `https://canvas.gmu.edu`
2. `https://gmu.instructure.com`

The IPC surface today includes:
- `canvas:setToken`, `canvas:getToken`, `canvas:clearToken`, `canvas:testToken`
- `canvas:get` – a generic authenticated GET proxy used by the renderer client (`src/lib/canvasClient.ts`).

The renderer client provides convenience wrappers:
- `getUserProfile()`
- `getCourses()` (active courses only)
- `getAssignments(courseId)` (upcoming bucket per course)
- `getCalendarEvents(startISO, endISO)` (assignment calendar events between the supplied ISO timestamps)

Responses from IPC follow a shared `IpcResult<T>` shape: `{ ok: true, data }` or `{ ok: false, error, status? }` to avoid
throwing across the bridge and to make error handling explicit in the renderer.

Assignments are aggregated across all active courses and filtered to the next 14 days. Calendar events are requested once for the
same 14 day window.

## Troubleshooting
- **401 Unauthorized**: The token is expired or scoped incorrectly. Generate a fresh token and connect again. Saved invalid tokens
  are cleared automatically after a failed validation.
- **Different Canvas host**: The IPC fetcher falls back from `canvas.gmu.edu` to `gmu.instructure.com`. If both fail, a toast is
  shown in the renderer with the reason code from the last failure.
- **Keychain prompts**: Some operating systems may prompt to allow keychain access on first launch. Approve access so `keytar` can
  save the token.

## Production build
```bash
npm run build
```

The build command produces production-ready Electron and renderer bundles. Use `npm run preview` to run the built assets without
the Vite dev server.

## Deliverables pipeline adapters

The deliverables pipeline now relies on pluggable renderer adapters that implement the contract defined in
`electron/deliverables/renderers/adapter.ts`.

- Each adapter reports its supported artifact kinds through `handles` and exposes an asynchronous `health()` check that must
  never throw.
- `render()` receives the artifact metadata, a destination directory, an `AbortSignal`, and an optional `dryRun` flag. Adapters
  must respect the abort signal and return structured `DeliverableJobResult` objects (never throwing).
- When adding a new adapter, implement the interface and call `register(adapter)` from
  `electron/deliverables/renderers/registry.ts`. Registering multiple adapters for the same kind allows healthy adapters to be
  preferred with automatic fallback to safe copy handlers.

### Feature flags & external tools

Runtime adapters are gated behind environment variables so that the application remains functional without optional tooling.

- `DELIV_HTML_PUPPETEER=1` enables the Chromium/Puppeteer HTML renderer. Set `CHROME_PATH` if Chromium/Chrome is not available
  on the system path.
- `DELIV_DOCX_LIBREOFFICE=1` enables LibreOffice CLI conversions for `.docx` files.
- `DELIV_PDF_QPDF=1` enables qpdf linearisation/repair for `.pdf` artifacts.
- `DELIV_TIMEOUT_MS` controls the hard timeout for external processes (default 120 000 ms).

When a feature flag is disabled or the tool health check fails, the registry falls back to the safe copy/static adapters so that
existing behaviour remains stable. The renderer UI exposes the desired adapter, its current health, and the configured fallback
for each artifact type.

### Tool prerequisites

- **Chromium / Google Chrome / Microsoft Edge** for the Puppeteer HTML renderer (`CHROME_PATH` can point to the binary).
- **LibreOffice** (`soffice` CLI) for DOCX → PDF conversion.
- **qpdf** for PDF linearisation and repair.

All external processes run with strict timeouts, respect abort signals, and write outputs atomically to avoid partial files.
The HTML renderer blocks all non-`file://` network requests and removes inline scripts and event handlers before printing to
PDF.

### Dry run expectations

Running the pipeline with `{ dryRun: true }` invokes each adapter in metadata-only mode. Adapters must avoid copying or
transforming the source artifact and instead emit just a `.meta.json` file describing the intended output. The pipeline still
records the run history, adapter identifiers, attempt counts, and transient retry information.

### Run summaries, badges, and reports

- Every deliverables job now carries a deterministic status badge (`success`, `warning`, `error`, `cancelled`, or `skipped`).
  Badges surface in the renderer UI and exported reports so that runs can be triaged at a glance.
- Completed runs are summarised into `runs.summary.json` alongside the existing history file. The standard summary captures
  totals, adapter usage, fallback counts, and top validation errors without performing any network calls.
- You can regenerate a summary via the `deliverables:rebuildSummary` IPC handler or the "Rebuild summary" button in the
  renderer. The regenerated output is deterministic for a given run.
- Reports export to `<userData>/deliverables/reports/<runId>.html` or `.json`. HTML exports are fully self-contained and safe to
  open offline.
- Optional AI summaries are behind the `DELIV_AI_SUMMARY` flag and require an OpenAI-compatible API key. When the flag or key
  is missing the AI path is skipped without warnings, keeping tests and default usage offline-friendly.

### Deliverable insights

- Offline parsers generate structured insight bundles under `<userData>/deliverables/insights/<runId>.json`. Files larger than
  `INSIGHTS_MAX_BYTES_MB` (default 20 MB) or exceeding `INSIGHTS_MAX_PAGES` (default 50) are skipped with warnings instead of
  throwing.
- Extracted text is processed entirely with built-in Node utilities—HTML scrapers strip scripts and styles, DOCX files are read
  from their zipped XML parts, and PDFs fall back to page counting if text streams are unreadable.
- Redaction is enabled by default via `DELIV_INSIGHTS_REDACT=1` and masks emails, phone numbers, student IDs, and labelled names
  before keywording or AI prompts. Toggle it by setting the flag to `0` if you need raw text locally.
- Optional AI insight summaries require `DELIV_AI_INSIGHTS=1`, a valid `OPENAI_API_KEY`, and respect
  `DELIV_AI_INSIGHTS_TIMEOUT_MS` (default 8 seconds). Errors are surfaced as data so UI flows never break when the model is
  unavailable.

### Local actions, archiving, and retention

- The Deliverables view now exposes a **Local** column for each artifact. From there you can reveal outputs in the system
  file manager, open them directly, or send them to the OS trash without leaving the app. Multi-select checkboxes allow you to
  zip a subset of artifacts in one click.
- A dedicated **Storage** panel summarises the application data directories (user data, outputs, archives) and surfaces
  convenience actions. "Archive this run" streams the latest run into
  `<userData>/deliverables/archives/<runId>.zip` using Node's `zlib` implementation and atomic writes.
- Retention controls support dry runs and real deletions. The sweeper only targets folders under
  `<userData>/deliverables/outputs`, honours the `DELIV_PROTECT_RECENT_RUNS` safeguard to keep the newest runs per artifact, and
  moves data to the system trash unless `DELIV_HARD_DELETE=1`.
- Environment defaults are configurable via `.env`:
  - `DELIV_RETENTION_DAYS` (default 30) controls how long outputs are kept.
  - `DELIV_PROTECT_RECENT_RUNS` (default 3) keeps the newest runs per artifact regardless of age.
  - `DELIV_HARD_DELETE` toggles between trashing and permanent deletes.
  - `DELIV_AUTO_ARCHIVE=1` enables background archiving whenever a run completes successfully.
- All filesystem operations resolve and normalise paths under `<userData>`, returning structured results rather than throwing.

### Post-processing rules and course context

An optional post-processing layer runs after successful renders to rename, move, or tag deliverable outputs. Rules are stored as
JSON in `<userData>/deliverables.rules.json` and can be edited from the Deliverables view. The renderer exposes toggles for
enabling post-processing, forcing a dry run, and capturing course context (`courseId`, `assignmentId`, `courseName`, `dueDate`).
A live preview lists the rules that would match the current selection before invoking the pipeline.

Rules follow this structure:

```json
[
  {
    "id": "rename",
    "enabled": true,
    "when": { "type": ["pdf"], "badge": ["success"] },
    "actions": [
      { "kind": "rename", "pattern": "(.+)(\\.pdf)", "replace": "{courseId}_{assignmentId}_{artifactId}$2" }
    ]
  },
  {
    "id": "move",
    "enabled": true,
    "when": { "type": ["pdf"], "badge": ["success"] },
    "actions": [
      { "kind": "move", "targetDir": "{courseId}/{assignmentId}" }
    ]
  }
]
```

Supported interpolation tokens are `{courseId}`, `{courseName}`, `{assignmentId}`, `{dueDate}`, `{artifactId}`, `{adapterId}`,
`{type}`, `{runId}`, and `{timestamp}` (additional course metadata keys are available through the `meta` object). All tokens are
sanitised by replacing path separators, quotes, and illegal filesystem characters with underscores to keep resulting paths safe.
Two common due-date driven examples are:

- Move to `final/{courseId}/{assignmentId}/{type}` so each run lands in a deterministic delivery folder.
- Rename outputs to `{courseId}_{assignmentId}_{artifactId}` to align with LMS submission naming conventions.

Safety guardrails include:

- Only files under `<userData>/deliverables/outputs/<runId>` are eligible for post-processing.
- File writes are atomic: move and rename actions stage into a temporary file before replacing the destination.
- External moves are blocked unless `DELIV_ALLOW_EXTERNAL_MOVE=1` is set. By default, move targets must remain within
  `<userData>/deliverables/final`.
- Invalid rename patterns (for example, those that can match the empty string) are rejected and reported back in the run record.
- Post actions never throw; errors are captured in the run metadata and surfaced in the UI.

When post-processing is enabled, run records gain a `post` section that lists the applied rule IDs, per-action results, and an
overall success flag. Dry runs produce identical audit trails without touching the filesystem so that rules can be rehearsed
before committing to a new workflow.
