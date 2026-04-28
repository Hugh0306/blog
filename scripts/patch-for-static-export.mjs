/**
 * Pre-build patch for VPS static export.
 * Replaces Vite-specific import.meta.glob calls with Node.js fs equivalents.
 * Only runs in CI when STATIC_EXPORT=1.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// ── posts.ts ──────────────────────────────────────────────────────────────────

const postsFile = path.join(root, "src/lib/content/posts.ts");
let postsContent = fs.readFileSync(postsFile, "utf-8");

const postsGlobPattern =
  /const markdownFiles = import\.meta\.glob\([^;]+?\);/s;

const postsReplacement = `const markdownFiles: Record<string, string> = (() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _path = require("path") as typeof import("path");
  const baseDir = _path.join(process.cwd(), "content", "posts");
  const result: Record<string, string> = {};
  function walk(dir: string) {
    for (const e of _fs.readdirSync(dir, { withFileTypes: true })) {
      const full = _path.join(dir, e.name);
      if (e.isDirectory()) { walk(full); }
      else if (e.name.endsWith(".md")) {
        const rel = _path.relative(baseDir, full).replace(/\\\\/g, "/");
        result["/content/posts/" + rel] = _fs.readFileSync(full, "utf-8");
      }
    }
  }
  walk(baseDir);
  return result;
})();`;

if (!postsGlobPattern.test(postsContent)) {
  console.error("ERROR: could not find import.meta.glob in posts.ts");
  process.exit(1);
}
postsContent = postsContent.replace(postsGlobPattern, postsReplacement);
fs.writeFileSync(postsFile, postsContent);
console.log("Patched: posts.ts");

// ── utils.ts ──────────────────────────────────────────────────────────────────

const utilsFile = path.join(root, "src/lib/content/utils.ts");
let utilsContent = fs.readFileSync(utilsFile, "utf-8");

const utilsGlobPattern =
  /const cacheFiles = import\.meta\.glob\([^;]+?\);/s;

const utilsReplacement = `const cacheFiles: Record<string, unknown> = (() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _path = require("path") as typeof import("path");
  const p = _path.join(process.cwd(), "data", "image-dimensions.json");
  const r: Record<string, unknown> = {};
  if (_fs.existsSync(p)) {
    r["/data/image-dimensions.json"] = JSON.parse(_fs.readFileSync(p, "utf-8"));
  }
  return r;
})();`;

if (!utilsGlobPattern.test(utilsContent)) {
  console.error("ERROR: could not find import.meta.glob in utils.ts");
  process.exit(1);
}
utilsContent = utilsContent.replace(utilsGlobPattern, utilsReplacement);
fs.writeFileSync(utilsFile, utilsContent);
console.log("Patched: utils.ts");

// ── author-profile.ts ─────────────────────────────────────────────────────────

const profileFile = path.join(root, "src/lib/content/author-profile.ts");
let profileContent = fs.readFileSync(profileFile, "utf-8");

const profileGlobPattern =
  /const reportModules = import\.meta\.glob\([^;]+?\) as Record<string, unknown>;/s;

const profileReplacement = `const reportModules: Record<string, unknown> = (() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _fs = require("fs") as typeof import("fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const _path = require("path") as typeof import("path");
  const dir = _path.join(process.cwd(), "data", "reports");
  const result: Record<string, unknown> = {};
  if (_fs.existsSync(dir)) {
    for (const f of _fs.readdirSync(dir)) {
      if (f.endsWith(".json")) {
        result["/data/reports/" + f] = JSON.parse(
          _fs.readFileSync(_path.join(dir, f), "utf-8")
        );
      }
    }
  }
  return result;
})();`;

if (!profileGlobPattern.test(profileContent)) {
  console.error("ERROR: could not find import.meta.glob in author-profile.ts");
  process.exit(1);
}
profileContent = profileContent.replace(profileGlobPattern, profileReplacement);
fs.writeFileSync(profileFile, profileContent);
console.log("Patched: author-profile.ts");

console.log("All patches applied successfully.");
