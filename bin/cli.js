#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { startServer } from "../server/server.js";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  cc-studio-dashboard

  Usage:
    cc-studio-dashboard [options]

  Options:
    -p, --port <number>  Port number (default: 3940)
    -d, --dir <path>     Directory to search for .studio/ (default: cwd)
                         If not found, dashboard runs in setup-only mode.
    --no-open            Don't open browser automatically
    -h, --help           Show this help
    -v, --version        Show version
  `);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  const pkg = JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8")
  );
  console.log(pkg.version);
  process.exit(0);
}

function getArg(flag1, flag2, defaultValue) {
  let idx = args.indexOf(flag1);
  if (idx === -1) idx = args.indexOf(flag2);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}

const port = parseInt(getArg("-p", "--port", "3940"), 10);
const baseDir = path.resolve(getArg("-d", "--dir", process.cwd()));
const noOpen = args.includes("--no-open");

// Find .studio/ directory (walk up from baseDir)
function findStudioDir(startDir, maxDepth = 5) {
  let dir = startDir;
  for (let i = 0; i < maxDepth; i++) {
    const candidate = path.join(dir, ".studio");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const studioDir = findStudioDir(baseDir);

if (!studioDir) {
  console.log(`\n  .studio/ folder not found.`);
  console.log(`  Starting in setup mode — use the dashboard to scan and create one.\n`);
  console.log(`  Searched from: ${baseDir}\n`);
} else {
  console.log(`\n  cc-studio dashboard`);
  console.log(`  Watching: ${studioDir}\n`);
}

startServer({ studioDir, baseDir, port });

if (!noOpen) {
  import("open")
    .then((mod) => mod.default(`http://localhost:${port}`))
    .catch(() => {});
}
