import fs from "fs";
import path from "path";
import matter from "gray-matter";

export function readMarkdown(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = matter(raw);
    return { frontmatter: parsed.data, body: parsed.content, raw };
  } catch {
    return null;
  }
}

export function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md") && !e.name.startsWith("_"))
    .map((e) => e.name);
}

export function fileMtime(filePath) {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return null;
  }
}

export function dirLatestMtime(dir) {
  if (!fs.existsSync(dir)) return null;
  let latest = null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_")) {
      const mtime = fs.statSync(path.join(dir, entry.name)).mtime;
      if (!latest || mtime > latest) latest = mtime;
    }
  }
  return latest ? latest.toISOString() : null;
}

export function countOpenItems(dir) {
  // Counts unchecked [ ] task markers in markdown files under dir
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_")) {
      const content = fs.readFileSync(path.join(dir, entry.name), "utf-8");
      const matches = content.match(/^\s*-\s+\[ \]/gm);
      if (matches) count += matches.length;
    }
  }
  return count;
}
