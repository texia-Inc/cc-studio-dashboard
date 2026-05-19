import fs from "fs";
import path from "path";
import { readMarkdown, dirLatestMtime, countOpenItems } from "./parser.js";

// Studio dashboard data shape:
// {
//   studio: { frontmatter, ... },          ← from .studio/CLAUDE.md
//   manager: { todosLatest, inboxLatest }, ← from .studio/studio/
//   apps: [
//     {
//       id: "app-a",
//       name: "App A",
//       state: "operating",
//       appType: "web",
//       repoPath: "...",
//       github: "...",
//       description: "...",
//       lastUpdated: ISO date,
//       openIssues: 3,
//       openIdeas: 2,
//       openFeedback: 1,
//       latestRelease: "v1.2.0",
//     },
//     ...
//   ]
// }

const STUDIO_DEPT = "studio";

export function scan(studioDir) {
  if (!studioDir || !fs.existsSync(studioDir)) {
    return { available: false, studio: null, manager: null, apps: [] };
  }

  // Read root CLAUDE.md
  const studioRoot = readMarkdown(path.join(studioDir, "CLAUDE.md"));

  // Manager (studio/) status
  const managerDir = path.join(studioDir, STUDIO_DEPT);
  const manager = {
    exists: fs.existsSync(managerDir),
    todosLatest: dirLatestMtime(path.join(managerDir, "todos")),
    inboxLatest: dirLatestMtime(path.join(managerDir, "inbox")),
    notesLatest: dirLatestMtime(path.join(managerDir, "notes")),
    openTodos: countOpenItems(path.join(managerDir, "todos")),
  };

  // Apps (every directory in studioDir except STUDIO_DEPT and starting with _)
  const apps = [];
  for (const entry of fs.readdirSync(studioDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === STUDIO_DEPT) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;

    const appDir = path.join(studioDir, entry.name);
    const claudeMd = readMarkdown(path.join(appDir, "CLAUDE.md"));
    const fm = claudeMd?.frontmatter || {};

    const issuesDir = path.join(appDir, "issues");
    const ideasDir = path.join(appDir, "ideas");
    const feedbackDir = path.join(appDir, "feedback");
    const releasesDir = path.join(appDir, "releases");

    // Latest release filename (highest semver or latest mtime)
    let latestRelease = null;
    if (fs.existsSync(releasesDir)) {
      const files = fs
        .readdirSync(releasesDir)
        .filter((f) => f.endsWith(".md") && !f.startsWith("_"));
      if (files.length > 0) {
        files.sort();
        latestRelease = files[files.length - 1].replace(/\.md$/, "");
      }
    }

    apps.push({
      id: entry.name,
      name: fm.name || entry.name,
      state: fm.state || "unknown",
      appType: fm.app_type || fm.appType || null,
      repoPath: fm.repo_path || fm.repoPath || null,
      github: fm.github || fm.github_url || null,
      prodUrl: fm.prod_url || fm.prodUrl || null,
      description: fm.description || extractDescription(claudeMd?.body),
      lastUpdated:
        dirLatestMtime(issuesDir) ||
        dirLatestMtime(ideasDir) ||
        dirLatestMtime(feedbackDir) ||
        dirLatestMtime(appDir),
      openIssues: countOpenItems(issuesDir),
      openIdeas: countOpenItems(ideasDir),
      openFeedback: countOpenItems(feedbackDir),
      latestRelease,
    });
  }

  // Sort by lastUpdated desc (nulls last)
  apps.sort((a, b) => {
    if (!a.lastUpdated && !b.lastUpdated) return 0;
    if (!a.lastUpdated) return 1;
    if (!b.lastUpdated) return -1;
    return b.lastUpdated.localeCompare(a.lastUpdated);
  });

  return {
    available: true,
    studioDir,
    studio: studioRoot
      ? { frontmatter: studioRoot.frontmatter, body: studioRoot.body }
      : null,
    manager,
    apps,
  };
}

function extractDescription(body) {
  if (!body) return null;
  // Take first non-empty line after ## 概要 heading, else first paragraph
  const overviewMatch = body.match(/##\s*概要\s*\n+([^\n]+)/);
  if (overviewMatch) return overviewMatch[1].trim();
  const firstPara = body
    .split("\n\n")
    .map((p) => p.trim())
    .find((p) => p && !p.startsWith("#"));
  return firstPara ? firstPara.split("\n")[0] : null;
}
