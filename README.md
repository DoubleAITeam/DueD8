# DueD8
DueD8 is an AI-powered desktop app that connects to Canvas, syncs courses and assignments, explains tasks, generates practice problems, and sends reminders. Our mission: save students hours weekly and keep them ahead with a clean, automated, all-in-one study dashboard.
=======
# DueD8 Working Starter

This is a clean Electron + Vite + React + TypeScript starter configured to avoid the common "Electron window not showing" issue.

## Install
```bash
npm i
```

## Develop
```bash
npm run dev
```
This will:
- Build Electron main and preload to `dist-electron`
- Start Vite dev server on port 5173
- Wait for both `main.js`, `preload.js`, and the dev server, then launch Electron

## Production build
```bash
npm run build
# To preview a packaged-like run without dev server:
npm run preview
# Then start Electron manually:
npx electron .
```

If the window still does not open, check terminal logs for lines starting with `[electron]`.
>>>>>>> 8f5f4cd (Initial commit: working Electron + React setup)
