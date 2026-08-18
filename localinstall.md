# AIRAVATA DEA — Local Electron Setup

This guide explains how to download the project from GitHub, install it, run the existing application inside Electron, and build a Windows `.exe` or macOS `.dmg`.

The Electron app is a desktop wrapper around the existing React/Vite application. The application is not rebuilt from scratch and the browser version remains available.

## 1. Install the prerequisites

### Windows

Install these applications:

1. **Git**: https://git-scm.com/download/win
2. **Node.js 20 LTS or newer**: https://nodejs.org/
3. **Visual Studio Code**: https://code.visualstudio.com/download
4. **pnpm**

Open PowerShell and run:

```powershell
corepack enable
corepack prepare pnpm@10.26.1 --activate
```

Close and reopen PowerShell, then verify:

```powershell
git --version
node --version
pnpm --version
```

### macOS

Install these applications:

1. **Git**: normally included with Xcode Command Line Tools
2. **Node.js 20 LTS or newer**: https://nodejs.org/
3. **Visual Studio Code**: https://code.visualstudio.com/download
4. **pnpm**

In Terminal, run:

```bash
xcode-select --install
corepack enable
corepack prepare pnpm@10.26.1 --activate
```

Verify:

```bash
git --version
node --version
pnpm --version
```

## 2. Download the project

Replace the URL with the GitHub repository URL:

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
cd YOUR-REPOSITORY
code .
```

If the `code` command is not available, open VS Code manually and select **File → Open Folder**.

## 3. Install all project dependencies

Run this once from the project root:

```bash
pnpm install
```

This installs:

- React and Vite dependencies
- The Express API dependencies
- Electron
- Electron Builder
- The desktop development helpers

Do not run `npm install` or `yarn install` in this project. It is a pnpm workspace.

## 4. Start the desktop application

From the project root, run one command:

```bash
pnpm desktop:dev
```

This starts the existing Vite frontend and API server, waits for the frontend to become available, and opens the Electron desktop window.

The normal web preview is available at:

```text
http://127.0.0.1:5000
```

Close the Electron window and press `Ctrl+C` in the terminal to stop the development servers.

## 5. Start the parts separately

Use this only if you need to debug the frontend or API separately.

Terminal 1:

```bash
pnpm --filter @workspace/csv-profiler run dev
```

Terminal 2:

```bash
pnpm --filter @workspace/csv-profiler-desktop exec electron .
```

## 6. Build the desktop installer

Build the React frontend first:

```bash
pnpm desktop:build:web
```

Then create the installer for the operating system you are currently using:

```bash
pnpm desktop:build
```

Output files are created in:

```text
artifacts/desktop/release/
```

### Windows

Run the build on Windows. It creates an NSIS installer ending in `.exe`.

```powershell
pnpm desktop:build:web
pnpm desktop:build
```

### macOS

Run the build on macOS. It creates a disk image ending in `.dmg`.

```bash
pnpm desktop:build:web
pnpm desktop:build
```

Build each platform on that platform. For example, build the Windows installer on Windows and the macOS installer on macOS.

## 7. Using the desktop application

The desktop version keeps the existing workflow:

1. Load a layout file.
2. Load the fixed-width data file.
3. Assign the layout.
4. Choose encryption settings.
5. Choose an output folder when prompted.
6. Process and export the result.

The desktop shell provides native local-folder selection. The existing record preview remains intentionally limited so that displaying millions of rows does not freeze the interface; processing itself is not limited to the preview count.

## 8. Common problems

### `pnpm` is not recognized

Restart the terminal after enabling Corepack. If it still fails, install pnpm directly:

```bash
npm install --global pnpm@10.26.1
```

### Electron does not start

Run:

```bash
pnpm install
pnpm --filter @workspace/csv-profiler-desktop exec electron --version
```

If the Electron download was interrupted, remove dependencies and reinstall:

Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
pnpm install
```

macOS/Linux:

```bash
rm -rf node_modules
pnpm install
```

### Port 5000 or 3001 is already in use

Stop another development server using that port, then run:

```bash
pnpm desktop:dev
```

### macOS blocks the application

Unsigned local builds may show a security warning. Open **System Settings → Privacy & Security**, then allow the application. For public distribution, the app should be code-signed and notarized.

## Quick version

After cloning the repository, the usual workflow is:

```bash
pnpm install
pnpm desktop:dev
```

To create an installer:

```bash
pnpm desktop:build:web
pnpm desktop:build
```