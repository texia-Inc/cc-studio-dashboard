// Creates an app department under .studio/ from a candidate descriptor.
// Used when the user clicks "Import" on a discovered repo.

import fs from "fs";
import path from "path";

const SUBFOLDERS = ["issues", "ideas", "releases", "feedback", "metrics"];

/**
 * Import a single app into the studio.
 * @param studioDir absolute path to .studio/
 * @param app { id, name, state, appType, repoPath, github, prodUrl, description }
 * @returns { ok, appDir, created? }
 */
export function importApp(studioDir, app) {
  if (!studioDir || !fs.existsSync(studioDir)) {
    return { ok: false, error: ".studio/ not found" };
  }
  if (!app || !app.id) {
    return { ok: false, error: "app.id required" };
  }
  const safeId = String(app.id)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!safeId) return { ok: false, error: "invalid app id" };

  const appDir = path.join(studioDir, safeId);
  if (fs.existsSync(appDir)) {
    return { ok: false, error: `App folder already exists: ${safeId}` };
  }

  fs.mkdirSync(appDir, { recursive: true });
  for (const sub of SUBFOLDERS) {
    fs.mkdirSync(path.join(appDir, sub));
  }

  const today = new Date().toISOString().slice(0, 10);
  const fm = renderFrontmatter({
    type: "department",
    role: "app",
    name: app.name || safeId,
    state: app.state || "developing",
    app_type: app.appType || "other",
    repo_path: app.repoPath || null,
    github: app.github || null,
    prod_url: app.prodUrl || null,
    created: today,
  });

  const body = renderBody(app);
  fs.writeFileSync(path.join(appDir, "CLAUDE.md"), `${fm}\n\n${body}\n`, "utf-8");

  // Empty roadmap
  fs.writeFileSync(
    path.join(appDir, "roadmap.md"),
    `---
app: "${app.name || safeId}"
type: roadmap
updated: "${today}"
---

# ${app.name || safeId} - ロードマップ

## 直近（今月〜来月）

- [ ]

## 中期（3ヶ月）

- [ ]

## 将来

- [ ]

## 終わったこと

- [x]
`,
    "utf-8"
  );

  return { ok: true, appDir, created: safeId };
}

/**
 * Bulk import multiple apps. Returns { results: [...] }.
 */
export function importMany(studioDir, apps) {
  const results = [];
  for (const app of apps) {
    results.push({ id: app.id, ...importApp(studioDir, app) });
  }
  return { results };
}

function renderFrontmatter(obj) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    lines.push(`${k}: ${formatValue(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

function formatValue(v) {
  if (typeof v === "string" && (v.includes(":") || v.includes("#"))) {
    return JSON.stringify(v);
  }
  return v;
}

function renderBody(app) {
  return `# ${app.name || app.id}

## 概要

${app.description || ""}

## 状態

- **現在の状態**: ${app.state || "developing"}
- **作成日**: ${new Date().toISOString().slice(0, 10)}
- **最終リリース**: なし

## URL

- **本番**: ${app.prodUrl || ""}
- **GitHub**: ${app.github || ""}

## ローカルパス

\`${app.repoPath || ""}\`

## サブフォルダ

- \`roadmap.md\` - 次やること
- \`issues/\` - バグ・課題
- \`ideas/\` - 機能アイデア
- \`releases/\` - リリースノート
- \`feedback/\` - ユーザーフィードバック
- \`metrics/\` - 月次の数字
`;
}
