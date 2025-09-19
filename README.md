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

## Assignment actions and generation behavior
- Assignment classification now runs in the Electron main process. When the classifier flags a file as instructions-only, the
  **Generate completed assignment** button stays disabled with a tooltip and an inline note directs students to the study guide.
- Completed submissions are generated only on demand and provide both Google Doc (.docx) and PDF downloads styled to match the
  prompt. Each document includes mirrored numbering, default APA7 citations when no style is detected, and links back to Canvas
  attachments.
- The generation panel shows non-blocking progress with cancel/resume controls. If a run exhausts the free token budget, the
  rendered sections remain polished and an upgrade banner surfaces before continuing.
