/**
 * Pre-build patch for VPS static export.
 * Replaces Vite-specific import.meta.glob calls with Node.js equivalents.
 * Safe strategy: avoid require/import fs in files that are used by client components.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// ── posts.ts ──────────────────────────────────────────────────────────────────
// Server-only file, safe to use node:fs

const postsFile = path.join(root, "src/lib/content/posts.ts");
let postsContent = fs.readFileSync(postsFile, "utf-8");

// Add node:fs imports at the top (after first line)
const postsNodeImports = `import { readFileSync as _readFileSync, readdirSync as _readdirSync } from "node:fs";
import { join as _join, relative as _relative } from "node:path";
`;

const postsGlobPattern =
  /const markdownFiles = import\.meta\.glob\([^;]+?\);/s;

const postsReplacement = `const markdownFiles: Record<string, string> = (() => {
  const baseDir = _join(process.cwd(), "content", "posts");
  const result: Record<string, string> = {};
  function walk(dir: string) {
    for (const e of _readdirSync(dir, { withFileTypes: true })) {
      const full = _join(dir, e.name);
      if (e.isDirectory()) { walk(full); }
      else if (e.name.endsWith(".md")) {
        const rel = _relative(baseDir, full).replace(/\\\\/g, "/");
        result["/content/posts/" + rel] = _readFileSync(full, "utf-8");
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

// Add imports after the first line
const postsLines = postsContent.split("\n");
postsLines.splice(0, 0, postsNodeImports.trimEnd());
postsContent = postsLines.join("\n");
postsContent = postsContent.replace(postsGlobPattern, postsReplacement);
fs.writeFileSync(postsFile, postsContent);
console.log("Patched: posts.ts");

// ── utils.ts ──────────────────────────────────────────────────────────────────
// Used by client components — cannot use node:fs.
// Replace glob with empty object; image-dimensions cache will be skipped gracefully.

const utilsFile = path.join(root, "src/lib/content/utils.ts");
let utilsContent = fs.readFileSync(utilsFile, "utf-8");

const utilsGlobPattern =
  /const cacheFiles = import\.meta\.glob\([^;]+?\);/s;

const utilsReplacement =
  `const cacheFiles: Record<string, unknown> = {}; // static export: image-dimensions cache skipped`;

if (!utilsGlobPattern.test(utilsContent)) {
  console.error("ERROR: could not find import.meta.glob in utils.ts");
  process.exit(1);
}
utilsContent = utilsContent.replace(utilsGlobPattern, utilsReplacement);
fs.writeFileSync(utilsFile, utilsContent);
console.log("Patched: utils.ts");

// ── author-profile.ts ─────────────────────────────────────────────────────────
// Server-only file, safe to use node:fs

const profileFile = path.join(root, "src/lib/content/author-profile.ts");
let profileContent = fs.readFileSync(profileFile, "utf-8");

const profileNodeImports = `import { readFileSync as _pReadFileSync, readdirSync as _pReaddirSync, existsSync as _pExistsSync } from "node:fs";
import { join as _pJoin } from "node:path";
`;

const profileGlobPattern =
  /\/\/ eslint-disable-next-line @typescript-eslint\/ban-ts-comment\n\/\/ @ts-ignore Vite-specific API\nconst reportModules = import\.meta\.glob\([^;]+?\) as Record<string, unknown>;/s;

const profileReplacement = `const reportModules: Record<string, unknown> = (() => {
  const dir = _pJoin(process.cwd(), "data", "reports");
  const result: Record<string, unknown> = {};
  if (_pExistsSync(dir)) {
    for (const f of _pReaddirSync(dir)) {
      if (f.endsWith(".json")) {
        result["/data/reports/" + f] = JSON.parse(_pReadFileSync(_pJoin(dir, f), "utf-8"));
      }
    }
  }
  return result;
})();`;

if (!profileGlobPattern.test(profileContent)) {
  console.error("ERROR: could not find import.meta.glob in author-profile.ts");
  process.exit(1);
}

const profileLines = profileContent.split("\n");
profileLines.splice(0, 0, profileNodeImports.trimEnd());
profileContent = profileLines.join("\n");
profileContent = profileContent.replace(profileGlobPattern, profileReplacement);
fs.writeFileSync(profileFile, profileContent);
console.log("Patched: author-profile.ts");

console.log("All patches applied successfully.");

// ── category/[category]/page.tsx ──────────────────────────────────────────────
// Remove searchParams usage (dynamic, incompatible with static export).
// Pagination is handled via /category/[category]/page/[page] route.

const categoryPageFile = path.join(root, "src/app/category/[category]/page.tsx");
let categoryContent = fs.readFileSync(categoryPageFile, "utf-8");

// Remove searchParams from interface
categoryContent = categoryContent.replace(
  /\s*searchParams: Promise<\{ page\?: string \}>;/g,
  ""
);

// Remove searchParams from generateMetadata params
categoryContent = categoryContent.replace(
  /\{\s*\n\s*params,\s*\n\s*searchParams,\s*\n\s*\}: CategoryPageProps\): Promise<Metadata>/,
  "{ params }: { params: Promise<{ category: string }> }): Promise<Metadata>"
);

// Replace `const query = await searchParams;` and `const queryPage = ...` in generateMetadata
categoryContent = categoryContent.replace(
  /const query = await searchParams;\s*\n\s*const normalizedCategory = normalizeCategory\(category\);\s*\n\s*const queryPage = parsePositivePage\(query\.page\);/,
  "const normalizedCategory = normalizeCategory(category);\n  const queryPage = 1;"
);

// Remove searchParams from CategoryPage function params
categoryContent = categoryContent.replace(
  /\{\s*\n\s*params,\s*\n\s*searchParams,\s*\n\s*\}: CategoryPageProps\)/,
  "{ params }: { params: Promise<{ category: string }> })"
);

// Replace `const query = await searchParams;` and `const queryPage = ...` in CategoryPage
categoryContent = categoryContent.replace(
  /const query = await searchParams;\s*\n\s*const normalizedCategory = normalizeCategory\(category\);[\s\S]*?const queryPage = parsePositivePage\(query\.page\);/,
  "const normalizedCategory = normalizeCategory(category);\n  const queryPage = 1;"
);

// Remove redirect checks that used query.page
categoryContent = categoryContent.replace(
  /\n\s*if \(query\.page && queryPage <= 1\) \{\s*\n\s*permanentRedirect\(categoryUrl\(normalizedCategory\)\);\s*\n\s*\}/g,
  ""
);

fs.writeFileSync(categoryPageFile, categoryContent);
console.log("Patched: category/[category]/page.tsx");

// ── page.tsx (homepage) ───────────────────────────────────────────────────────
// Remove searchParams; homepage always shows first page in static export.

const homePageFile = path.join(root, "src/app/page.tsx");
const homePageContent = `import type { Metadata } from "next";
import { AIChatTrigger } from "@/components/ai-chat-box";
import { ArticleList } from "@/components/article-list";
import { CategoryNav } from "@/components/category-nav";
import { PaginationNav } from "@/components/pagination-nav";
import { RouteTransitionComplete } from "@/components/route-transition-complete";
import { getPostListing } from "@/lib/content/listings";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  return {
    alternates: { canonical: siteConfig.siteUrl },
  };
}

export default async function Home() {
  const listing = await getPostListing({});

  return (
    <main className="pb-8 pt-2">
      <RouteTransitionComplete />
      <CategoryNav />
      <AIChatTrigger />
      <ArticleList
        posts={listing.visiblePosts}
        hitsMap={listing.hitsMap}
        hitsLoading={listing.hitsLoading}
      />
      <PaginationNav page={listing.page} pageTotal={listing.pageTotal} />
    </main>
  );
}
`;

fs.writeFileSync(homePageFile, homePageContent);
console.log("Patched: page.tsx (homepage)");
