// Discovers existing repositories from GitHub (via gh CLI) or local filesystem.
// Used by the dashboard's Setup/Scan wizard to populate import candidates.

import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Scan GitHub via `gh` CLI. Returns up to `limit` repositories belonging to the
 * authenticated user. Requires `gh` to be installed and authenticated.
 */
export async function scanGithub({ limit = 100, includeForks = false } = {}) {
  try {
    const args = [
      "repo",
      "list",
      "--limit",
      String(limit),
      "--json",
      "name,nameWithOwner,description,url,sshUrl,updatedAt,isPrivate,isFork,isArchived,primaryLanguage,stargazerCount",
    ];
    const { stdout } = await execFileAsync("gh", args, { maxBuffer: 10 * 1024 * 1024 });
    const repos = JSON.parse(stdout);
    return {
      ok: true,
      source: "github",
      repos: repos
        .filter((r) => includeForks || !r.isFork)
        .map((r) => ({
          id: r.name,
          name: r.name,
          nameWithOwner: r.nameWithOwner,
          description: r.description || "",
          url: r.url,
          sshUrl: r.sshUrl,
          updatedAt: r.updatedAt,
          isPrivate: r.isPrivate,
          isArchived: r.isArchived,
          language: r.primaryLanguage?.name || null,
          stars: r.stargazerCount || 0,
        })),
    };
  } catch (err) {
    return { ok: false, source: "github", error: err.message || String(err) };
  }
}

/**
 * Scan a local directory tree for git repositories.
 * Walks up to `maxDepth` levels deep and returns directories containing a `.git` subdirectory.
 */
export async function scanLocal({ basePath, maxDepth = 3 } = {}) {
  if (!basePath) return { ok: false, source: "local", error: "basePath required" };
  const resolved = path.resolve(expandHome(basePath));
  if (!fs.existsSync(resolved)) {
    return { ok: false, source: "local", error: `Directory not found: ${resolved}` };
  }

  const repos = [];
  walk(resolved, 0, maxDepth, repos);
  return { ok: true, source: "local", basePath: resolved, repos };
}

function walk(dir, depth, maxDepth, results) {
  if (depth > maxDepth) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  // If this dir has a .git, treat it as a repo and don't descend further
  if (entries.some((e) => e.isDirectory() && e.name === ".git")) {
    results.push(describeRepo(dir));
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "node_modules") continue;
    walk(path.join(dir, entry.name), depth + 1, maxDepth, results);
  }
}

function describeRepo(repoDir) {
  const name = path.basename(repoDir);
  let lastCommit = null;
  let remoteUrl = null;
  let description = null;
  let language = null;
  try {
    // Last commit time
    const headLog = readFirstLine(path.join(repoDir, ".git", "logs", "HEAD"));
    if (headLog) {
      const parts = headLog.split(/\s+/);
      const tsIdx = parts.findIndex((p) => /^\d{10}$/.test(p));
      if (tsIdx !== -1) {
        lastCommit = new Date(parseInt(parts[tsIdx], 10) * 1000).toISOString();
      }
    }
    // Remote URL
    const config = path.join(repoDir, ".git", "config");
    if (fs.existsSync(config)) {
      const text = fs.readFileSync(config, "utf-8");
      const m = text.match(/\[remote "origin"\][^[]*url\s*=\s*([^\n]+)/);
      if (m) remoteUrl = m[1].trim();
    }
    // README first line
    for (const f of ["README.md", "Readme.md", "readme.md", "README"]) {
      const p = path.join(repoDir, f);
      if (fs.existsSync(p)) {
        const txt = fs.readFileSync(p, "utf-8");
        const line = txt
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith("#"));
        if (line) description = line.slice(0, 200);
        break;
      }
    }
    // Language hints from manifest files
    if (fs.existsSync(path.join(repoDir, "package.json"))) language = "JavaScript/TypeScript";
    else if (fs.existsSync(path.join(repoDir, "Cargo.toml"))) language = "Rust";
    else if (fs.existsSync(path.join(repoDir, "go.mod"))) language = "Go";
    else if (
      fs.existsSync(path.join(repoDir, "pyproject.toml")) ||
      fs.existsSync(path.join(repoDir, "requirements.txt"))
    )
      language = "Python";
    else if (fs.existsSync(path.join(repoDir, "Gemfile"))) language = "Ruby";
    else if (fs.existsSync(path.join(repoDir, "composer.json"))) language = "PHP";
  } catch {
    /* empty */
  }
  return {
    id: name,
    name,
    path: repoDir,
    description,
    remoteUrl,
    lastCommit,
    language,
  };
}

function readFirstLine(p) {
  try {
    if (!fs.existsSync(p)) return null;
    const text = fs.readFileSync(p, "utf-8");
    return text.split("\n")[0] || null;
  } catch {
    return null;
  }
}

function expandHome(p) {
  if (p.startsWith("~")) {
    return path.join(process.env.HOME || "", p.slice(1));
  }
  return p;
}

/**
 * Infer initial app state from last commit timestamp.
 */
export function inferState(lastCommitIso) {
  if (!lastCommitIso) return "developing";
  const ageDays = (Date.now() - new Date(lastCommitIso).getTime()) / 86400000;
  if (ageDays < 30) return "developing";
  if (ageDays < 90) return "operating";
  if (ageDays < 180) return "maintenance";
  return "maintenance"; // Could suggest sunset
}
