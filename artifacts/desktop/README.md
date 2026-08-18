# AIRAVATA DEA Desktop App

This is a desktop wrapper around the existing `artifacts/csv-profiler` React/Vite application. It does not duplicate or replace the web UI.

## Requirements

- Node.js 20+
- pnpm 10+
- Visual Studio Code
- Electron dependencies installed with `pnpm install`

## Run from VS Code

Open the repository root in VS Code, then open two terminals.

### Terminal 1 — start the existing web app

```bash
pnpm --filter @workspace/csv-profiler run dev
```

Leave this terminal running. The Vite app listens on `http://127.0.0.1:5000`.

### Terminal 2 — start Electron

```bash
pnpm --filter @workspace/csv-profiler-desktop exec electron .
```

Or start both automatically:

```bash
pnpm --filter @workspace/csv-profiler-desktop run dev:with-web
```

The Electron window loads the current application from the local Vite server.

## Build an installer

Build the frontend first, then package Electron:

```bash
pnpm --filter @workspace/csv-profiler-desktop run build:web
pnpm --filter @workspace/csv-profiler-desktop run build
```

Run the packaging command on the target operating system:

- Windows: creates an NSIS `.exe`
- macOS: creates a `.dmg`

Installers are written to `artifacts/desktop/release/`.

## Notes

- The desktop app uses the existing React interface and processing code.
- The desktop shell adds native output-folder selection through the preload bridge.
- Build Windows installers on Windows and macOS installers on macOS for the most reliable signing and packaging behavior.
- The first launch may show an operating-system warning if the installer is unsigned.