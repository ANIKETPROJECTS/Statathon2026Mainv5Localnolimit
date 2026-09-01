# AIRAVATA DEA Desktop Build Guide

This guide explains how to generate the AIRAVATA DEA desktop application from a local clone of the repository.

The desktop version is an Electron wrapper around the existing React/Vite CSV profiler. The browser application remains available separately.

## Important: Windows `.exe` versus macOS `.dmg`

A Windows `.exe` is a Windows application and does **not** run natively on macOS.

To run AIRAVATA DEA on macOS, generate a native macOS application instead. This project is configured to create a macOS `.dmg` installer.

Use:

- **Windows:** Build a Windows `.exe` installer on Windows.
- **macOS:** Build a macOS `.dmg` installer on macOS.

It is possible to try running a Windows `.exe` on macOS with compatibility software such as Wine or CrossOver, but that is not the native or recommended distribution method. A native `.dmg` is more reliable.

## Project requirements

The repository is a pnpm workspace. Run all commands from the repository root, the folder that contains the top-level `package.json`.

Required software:

- Git
- Node.js 20 LTS or newer
- pnpm 10
- Visual Studio Code (optional)

Do not use `npm install` or `yarn install` for this project.

## 1. Clone and open the repository

Replace the repository URL if you are using a different fork:

```bash
git clone https://github.com/ANIKETPROJECTS/Statathon2026Mainv5Localnolimit.git
cd Statathon2026Mainv5Localnolimit
code .
```

If the project has already been cloned, open the existing project folder in VS Code. Make sure the terminal is inside the cloned repository and not its parent folder.

You can verify the location with:

```bash
ls package.json
```

On Windows PowerShell, use:

```powershell
Get-ChildItem package.json
```

## 2. Configure pnpm

### Windows PowerShell

```powershell
corepack enable
corepack prepare pnpm@10.26.1 --activate
```

### macOS Terminal

```bash
corepack enable
corepack prepare pnpm@10.26.1 --activate
```

Close and reopen the terminal if `pnpm` is not recognized.

Verify the tools:

```bash
git --version
node --version
pnpm --version
```

## 3. Install dependencies

Run this once after cloning, or again after dependency changes:

```bash
pnpm install
```

This installs the React/Vite packages, API packages, Electron, Electron Builder, and desktop development helpers.

## 4. Optional: run the desktop app during development

To open the application in an Electron development window:

```bash
pnpm desktop:dev
```

Close the Electron window and press `Ctrl+C` in the terminal to stop the development processes.

## 5. Generate the Windows `.exe` installer

Build the Windows installer on a Windows computer. Building on Windows avoids the Wine requirements involved in cross-platform NSIS packaging.

From the repository root, run:

```powershell
pnpm desktop:build:web
pnpm desktop:build
```

The first command creates the production React/Vite frontend. The second command runs Electron Builder using the Windows NSIS configuration.

The output is created in:

```text
artifacts\desktop\release\
```

List the output files with:

```powershell
Get-ChildItem .\artifacts\desktop\release
```

You should see a Windows installer with a name similar to:

```text
AIRAVATA DEA CSV Profiler Setup 1.0.0.exe
```

You may also see:

```text
win-unpacked\
```

The `Setup ... .exe` file is the installer to distribute. The `win-unpacked` directory contains the unpacked application for testing.

## 6. Generate the native macOS `.dmg`

Build the macOS installer on a Mac. From the repository root, run:

```bash
pnpm desktop:build:web
pnpm desktop:build
```

The macOS build is configured in `artifacts/desktop/package.json` with a `.dmg` target.

The output is created in:

```text
artifacts/desktop/release/
```

List the output files with:

```bash
ls -lah artifacts/desktop/release
```

You should see a file similar to:

```text
AIRAVATA DEA CSV Profiler-1.0.0.dmg
```

Open the `.dmg`, drag AIRAVATA DEA into the Applications folder, and launch it from Applications.

## 7. macOS CPU architecture options

By default, Electron Builder builds for the current Mac architecture. To explicitly build for Apple Silicon:

```bash
pnpm desktop:build:web
pnpm --filter @workspace/csv-profiler-desktop exec electron-builder --mac dmg --arm64
```

To explicitly build for Intel Macs:

```bash
pnpm desktop:build:web
pnpm --filter @workspace/csv-profiler-desktop exec electron-builder --mac dmg --x64
```

Build on the same architecture as the target whenever possible. For wider distribution, create and test the appropriate architecture builds separately.

## 8. First-launch warning on macOS

Local macOS builds are not code-signed or notarized by default. macOS may block the first launch.

If that happens:

1. Open **System Settings**.
2. Go to **Privacy & Security**.
3. Look for the message that AIRAVATA DEA was blocked.
4. Select **Open Anyway**.

For public distribution, the application should be code-signed and notarized with an Apple Developer account.

## 9. Common problems

### `pnpm` is not recognized

Restart the VS Code terminal after running Corepack:

```bash
corepack enable
corepack prepare pnpm@10.26.1 --activate
```

Then check:

```bash
pnpm --version
```

### The build says that the web output is missing

Run the frontend build first:

```bash
pnpm desktop:build:web
```

Then run:

```bash
pnpm desktop:build
```

### Electron installation is incomplete

Remove the installed dependencies and install them again.

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

### A Windows installer build fails on Linux or macOS

The Windows NSIS installer may need Wine when it is built outside Windows. The reliable approach is to build the `.exe` on Windows itself.

To build an application for macOS, do not try to convert the Windows `.exe`. Build the native `.dmg` on macOS instead.

## Quick commands

### Windows `.exe`

```powershell
pnpm install
pnpm desktop:build:web
pnpm desktop:build
```

Output:

```text
artifacts\desktop\release\*.exe
```

### macOS `.dmg`

```bash
pnpm install
pnpm desktop:build:web
pnpm desktop:build
```

Output:

```text
artifacts/desktop/release/*.dmg
```