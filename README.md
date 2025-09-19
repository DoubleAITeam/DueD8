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

## Assignment actions and generation behavior
- The assignment detail view shows two primary actions: **Generate completed assignment** and **Generate guide**.
- A backend-only classifier marks assignment context as `instructions_only` or `solvable_assignment`. When the former is detected the completed-assignment button is disabled with a tooltip and a neutral inline note encourages students to use the guide.
- Completed assignment generation streams progress, allows cancel/resume, mirrors the original numbering, and defaults to Times New Roman 12pt double spacing when no styles are detected. A banner reminds students to add citations whenever sources are missing.
- Each run produces a DOCX download (framed as a Google Doc export) and a PDF download with links back to the Canvas assignment and referenced attachments.
- Study guides remain available independently of the completed document and reuse the Study Coach layout.

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
