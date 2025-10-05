# Configuration Reference

The deliverables subsystem is driven entirely through environment variables. The table below documents every supported key, the default value applied by `electron/deliverables/config/validate.ts`, and the behavioural impact.

| Variable | Default | Description |
| --- | --- | --- |
| `DELIVERABLES_USER_DATA` | _(unset)_ | Overrides the Electron `app.getPath('userData')` location for CLI invocations and smoke tests. Useful in CI to isolate filesystem writes. |
| `DELIVERABLE_MAX_MB` | `25` | Maximum artifact size in megabytes accepted during validation. Files above the limit are rejected before rendering. |
| `DELIV_TIMEOUT_MS` | `120000` | Hard timeout (ms) for renderer subprocesses. Jobs exceeding the limit are aborted. |
| `DELIV_MAX_PARALLEL_ARTIFACTS` | `2` | Upper bound on concurrent artifact rendering workers. Increase cautiously to avoid overloading CPU-bound adapters. |
| `DELIV_LOG_MEMORY_CAP` | `200` | Number of deliverables log entries retained in memory for IPC queries. |
| `DELIV_RETENTION_DAYS` | `30` | Age threshold (days) before run outputs are eligible for sweeping. |
| `DELIV_PROTECT_RECENT_RUNS` | `3` | Number of newest runs per artifact protected from sweeping regardless of age. |
| `DELIV_HARD_DELETE` | `false` | When `true`, sweeping permanently deletes files instead of moving them to the system trash. |
| `DELIV_AUTO_ARCHIVE` | `false` | When enabled, successful runs automatically trigger archive creation. |
| `DELIV_ALLOW_EXTERNAL_MOVE` | `false` | Gate for post-processing actions that move outputs outside the managed directories. |
| `DELIV_HTML_PUPPETEER` | `false` | Enables the Chromium/Puppeteer HTML renderer. Requires a valid Chromium binary (`CHROME_PATH` or auto-discovery). |
| `DELIV_DOCX_LIBREOFFICE` | `false` | Enables LibreOffice-backed `.docx` conversions. |
| `DELIV_PDF_QPDF` | `false` | Enables qpdf repair/linearisation for `.pdf` artifacts. |
| `DELIV_AI_SUMMARY` | `false` | Unlocks AI-powered run summaries. Requires `OPENAI_API_KEY` or `DELIV_OPENAI_API_KEY`. |
| `DELIV_AI_SUMMARY_TIMEOUT_MS` | `10000` | Timeout (ms) for AI summary requests. |
| `DELIV_AI_INSIGHTS` | `false` | Unlocks AI insight generation in addition to base parsing. |
| `DELIV_AI_INSIGHTS_TIMEOUT_MS` | `8000` | Timeout (ms) for AI insight calls. |
| `DELIV_INSIGHTS_REDACT` | `true` | When disabled, insight parsing skips redaction of sensitive fields. |
| `INSIGHTS_MAX_PAGES` | `50` | Page cap enforced during base insight parsing. |
| `INSIGHTS_MAX_BYTES_MB` | `20` | Maximum artefact size (MB) parsed for insights; larger files skip insight extraction. |
| `OPENAI_API_KEY` | _(unset)_ | Primary OpenAI-compatible API key used for AI summaries and insights. |
| `DELIV_OPENAI_API_KEY` | _(unset)_ | Fallback key lookup when `OPENAI_API_KEY` is not set. |
| `CHROME_PATH` | _(auto-discovered)_ | Absolute path to a Chromium/Chrome executable for the Puppeteer renderer. |

## Derived defaults

When no environment overrides are present, the validator applies conservative defaults (timeouts, retention caps, and feature flags disabled). Booleans interpret `1/true/on` as enabled and `0/false/off` as disabled. String-based keys trim whitespace before validation.

## Applying configuration

Create a `.env` file (see `.env.example`) or export variables in your shell before running Electron/CLI processes. Regenerate docs with `npm run docs:api` after altering TypeScript definitions to keep this table in sync with runtime behaviour.
