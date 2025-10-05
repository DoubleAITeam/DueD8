# OPERATIONS

## Overview
This runbook covers routine use, troubleshooting, and recovery for the Deliverables subsystem. All writes occur under Electron app.getPath('userData') (e.g. ~/Library/Application Support/DueD8). Atomic writes and guardrails prevent partial data and unsafe paths.

## Directory layout

Electron app.getPath('userData') (e.g. ~/Library/Application Support/DueD8)/
deliverables/
  outputs/
  archives/
  reports/
  insights/
  runs.json
logs/
  deliverables.log.jsonl

Additional config file:

Electron app.getPath('userData') (e.g. ~/Library/Application Support/DueD8)/deliverables.rules.json

## Common commands
Local CLI wrappers:
- `npm run deliverables:run`
- `npm run deliverables:summary`
- `npm run deliverables:insights`
- `npm run deliverables:archive`
- `npm run deliverables:sweep`
CI smoke:
- `npm run ci:deliverables`

## Environment configuration
See `.env.example` for full list. Important flags:
- Rendering
  - `DELIV_HTML_PUPPETEER` `0|1`
  - `DELIV_DOCX_LIBREOFFICE` `0|1`
  - `DELIV_PDF_QPDF` `0|1`
- Pipeline
  - `DELIVERABLES_CONCURRENCY` default 2 (defined in code defaults via `DELIV_MAX_PARALLEL_ARTIFACTS`)
  - `DELIV_TIMEOUT_MS` default 120000
  - `DELIVERABLE_MAX_MB` default 25
- Post-processing
  - `DELIV_ALLOW_EXTERNAL_MOVE` `0|1` default 0
- Archiving and retention
  - `DELIV_RETENTION_DAYS` default 30
  - `DELIV_PROTECT_RECENT_RUNS` default 3
  - `DELIV_HARD_DELETE` `0|1` default 0
  - `DELIV_AUTO_ARCHIVE` `0|1` default 0
- Insights and AI
  - `DELIV_INSIGHTS_REDACT` `0|1` default 1 (defined in code defaults)
  - `DELIV_AI_SUMMARY` `0|1` default 0
  - `DELIV_AI_INSIGHTS` `0|1` default 0 (defined in code defaults)

## Routine operations

### Run a batch
1) Open Deliverables view
2) Paste absolute file paths, one per line
3) Optional: enable dry run
4) Start run and watch progress and logs

### Export a report
- Use Export HTML or Export JSON in the UI
- Output saved under `deliverables/reports/` with file `{runId}.html|.json`

### Archive a run
- Click Archive this run or run `npm run deliverables:archive`
- Output zip saved under `deliverables/archives/{runId}.zip`

### Apply retention policy
- Dry run first in Storage panel
- Apply after reviewing the plan

## Post-processing rules
- Rules live at `deliverables.rules.json`
- Use the Rules editor in the UI to edit, preview matches, and reset to defaults
- External moves are blocked unless `DELIV_ALLOW_EXTERNAL_MOVE=1`

## Insights
- Build Base Insights offline from the Insights tab
- AI Insights are optional and time-boxed; require `DELIV_AI_INSIGHTS=1` and an API key
- Redaction is on by default and masks emails, phones, and IDs

## Recovery playbooks

### Rebuild a summary
- UI: Rebuild summary button
- CLI: `npm run deliverables:summary`

### Regenerate insights
- UI: Build Base Insights
- CLI: `npm run deliverables:insights`

### Clean storage
- Retention dry run from Storage panel
- Apply after review
- Never touches `runs.json` or reports

### Reset rules to defaults
- Use Rules editor Reset
- Or delete `deliverables.rules.json` to regenerate defaults

### Cancel a stuck run
- Use Cancel Run in the UI
- Verify no zombie processes in logs
- Partial results remain recorded

## System health
- Use the System drawer for feature flags, tool health, and paths
- If tools are unhealthy, registry falls back to safe adapters automatically

## Safety guarantees
- Atomic writes with `.tmp` followed by rename
- Guardrails prevent writes outside userData unless explicitly allowed
- Errors are data, not control flow. IPC returns `{ ok, data, error }`

## Known limits
- Max file size enforced by `DELIVERABLE_MAX_MB`
- Concurrency between 1 and 4 recommended
- PDF parsing is best effort offline

## Appendices

### IPC surfaces
See `docs/API_REFERENCE.md` for handler signatures.

### Troubleshooting quick list
- No progress updates: check IPC registration and preload types
- Adapter timeouts: verify tool availability or disable flag to fall back
- Retention removed too much: use dry run and protect recent runs, then re-archive if needed
- Reports empty: ensure summary exists for the given run
