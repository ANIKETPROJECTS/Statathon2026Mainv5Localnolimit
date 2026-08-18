const { spawn } = require("node:child_process");
const path = require("node:path");

const artifactDir = path.resolve(__dirname, "..");
const workspaceDir = path.resolve(artifactDir, "..", "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const viteModuleDir = path.dirname(require.resolve("vite", { paths: [artifactDir] }));
const vitePath = path.resolve(viteModuleDir, "..", "..", "bin", "vite.js");

const children = [
  spawn(pnpmCommand, ["--filter", "@workspace/api-server", "run", "dev"], {
    cwd: workspaceDir,
    stdio: "inherit",
    windowsHide: false,
  }),
  spawn(
    process.execPath,
    [vitePath, "--config", path.join(artifactDir, "vite.config.ts"), "--host", "0.0.0.0"],
    {
      cwd: artifactDir,
      stdio: "inherit",
      windowsHide: false,
    },
  ),
];

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  if (code !== 0) process.exitCode = code;
}

for (const child of children) {
  child.on("error", (error) => {
    console.error("Development process could not start:", error);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown && (code ?? 1) !== 0) {
      console.error(
        `Development process exited with ${signal ? `signal ${signal}` : `code ${code}`}.`,
      );
      shutdown(code ?? 1);
    }
  });
}

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());