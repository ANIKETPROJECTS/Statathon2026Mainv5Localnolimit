const { spawnSync, spawn } = require("node:child_process");
const path = require("node:path");

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const build = spawnSync(pnpmCommand, ["run", "build"], {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
  shell: false,
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
  cwd: path.resolve(__dirname, ".."),
  env: { ...process.env, NODE_ENV: "development", PORT: "3001" },
  stdio: "inherit",
});

const stop = (signal) => {
  if (!server.killed) server.kill(signal);
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));