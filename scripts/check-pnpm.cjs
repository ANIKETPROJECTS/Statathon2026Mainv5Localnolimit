const fs = require("node:fs");
const path = require("node:path");

for (const lockfile of ["package-lock.json", "yarn.lock"]) {
  const filePath = path.join(process.cwd(), lockfile);
  try {
    fs.rmSync(filePath, { force: true });
  } catch (error) {
    console.error(`Could not remove ${lockfile}: ${error.message}`);
    process.exit(1);
  }
}

const userAgent = process.env.npm_config_user_agent || "";
if (!userAgent.startsWith("pnpm/")) {
  console.error("Use pnpm instead of npm or yarn to install this workspace.");
  process.exit(1);
}