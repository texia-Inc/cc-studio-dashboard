import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { scan } from "./scanner.js";
import { scanGithub, scanLocal, inferState } from "./repo-scanner.js";
import { importMany } from "./importer.js";
import { createWatcher } from "./watcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

export function startServer({ studioDir, baseDir, port }) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const sseClients = new Set();

  let dashboardData = scan(studioDir);

  if (studioDir) {
    createWatcher(studioDir, () => {
      dashboardData = scan(studioDir);
      for (const res of sseClients) {
        res.write(`event: update\ndata: ${JSON.stringify(dashboardData)}\n\n`);
      }
    });
  }

  // Serve built React app
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
  }

  // ----- API -----

  // Status: whether .studio exists, where
  app.get("/api/status", (_req, res) => {
    res.json({
      available: !!studioDir,
      studioDir: studioDir || null,
      baseDir,
      cwd: process.cwd(),
      version: readVersion(),
    });
  });

  // Dashboard data (apps + manager)
  app.get("/api/dashboard", (_req, res) => {
    res.json(dashboardData);
  });

  // Scan GitHub via gh
  app.get("/api/scan/github", async (req, res) => {
    const limit = parseInt(req.query.limit || "100", 10);
    const includeForks = req.query.includeForks === "true";
    const result = await scanGithub({ limit, includeForks });
    if (result.ok) {
      // attach suggested state
      result.repos = result.repos.map((r) => ({
        ...r,
        suggestedState: inferState(r.updatedAt),
      }));
    }
    res.json(result);
  });

  // Scan local filesystem
  app.post("/api/scan/local", async (req, res) => {
    const basePath = req.body?.basePath || "~";
    const maxDepth = parseInt(req.body?.maxDepth || "3", 10);
    const result = await scanLocal({ basePath, maxDepth });
    if (result.ok) {
      result.repos = result.repos.map((r) => ({
        ...r,
        suggestedState: inferState(r.lastCommit),
      }));
    }
    res.json(result);
  });

  // Import apps
  app.post("/api/import", (req, res) => {
    if (!studioDir) {
      return res.status(400).json({
        ok: false,
        error: ".studio/ not found. Run /studio in Claude Code first to create one.",
      });
    }
    const apps = req.body?.apps;
    if (!Array.isArray(apps) || apps.length === 0) {
      return res.status(400).json({ ok: false, error: "apps array required" });
    }
    const result = importMany(studioDir, apps);
    // refresh data immediately
    dashboardData = scan(studioDir);
    res.json({ ok: true, ...result });
  });

  // File content (safe read within studioDir)
  app.get("/api/file", (req, res) => {
    if (!studioDir) return res.status(400).json({ error: ".studio/ not found" });
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: "path required" });
    const safePath = path.normalize(filePath).replace(/\.\./g, "");
    const fullPath = path.join(studioDir, safePath);
    if (!fullPath.startsWith(studioDir)) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: "File not found" });
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    res.json({ path: safePath, content });
  });

  // SSE for live updates
  app.get("/api/events", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`event: connected\ndata: {}\n\n`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
  });

  // SPA fallback
  app.get("*", (_req, res) => {
    const indexPath = path.join(distDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Build not found. Run 'npm run build' first.");
    }
  });

  app.listen(port, () => {
    console.log(`  http://localhost:${port}\n`);
  });
}

function readVersion() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8")
    );
    return pkg.version;
  } catch {
    return "unknown";
  }
}
