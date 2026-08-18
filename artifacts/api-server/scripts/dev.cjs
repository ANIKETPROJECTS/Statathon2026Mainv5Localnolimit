const { spawnSync, spawn } = require("node:child_process");
const path = require("node:path");

const build = spawnSync(process.execPath, ["./build.mjs"], {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit",
  shell: false,
});

if (build.error) {
  console.error("API build process could not start:", build.error);
  process.exit(1);
}
if (build.status !== 0) {
  console.error(`API build failed with exit code ${build.status ?? "unknown"}.`);
  process.exit(build.status ?? 1);
}

const serverPath = path.resolve(__dirname, "..", "dist", "index.mjs");
const server = spawn(process.execPath, ["--enable-source-maps", serverPath], {
  cwd: path.resolve(__dirname, ".."),
  env: { ...process.env, NODE_ENV: "development", PORT: "3001" },
  stdio: "inherit",
  windowsHide: false,
});

server.on("error", (error) => {
  console.error("API server process could not start:", error);
  process.exit(1);
});

const stop = (signal) => {
  if (!server.killed) server.kill(signal);
};
process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));