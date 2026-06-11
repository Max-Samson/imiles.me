import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const distDir = resolve("dist");
const astroDir = join(distDir, "_astro");
const homeUrl = process.env.PERF_URL;
const shouldFail = process.env.PERF_BUDGET_FAIL === "1";
const outputJson = process.argv.includes("--json");
const showHelp = process.argv.includes("--help") || process.argv.includes("-h");

const budgets = {
  cssRawBytes: 130 * 1024,
  heroRawBytes: 24 * 1024,
  initialBlockingStylesheets: 0,
  googleFontsStylesheets: 0,
  katexOnHome: 0,
};

function printHelp() {
  console.log(`Homepage performance budget checker

Usage:
  npm run perf:budget
  PERF_URL=http://127.0.0.1:4321/ npm run perf:budget
  npm run perf:budget -- --json
  PERF_BUDGET_FAIL=1 npm run perf:budget

Options:
  --json       Print the full machine-readable JSON report.
  --help, -h   Show this help.

Environment:
  PERF_URL            Optional served homepage URL. When set, the script also checks HTML links and islands.
  PERF_BUDGET_FAIL=1  Exit with a non-zero status when any configured budget fails.

What it checks:
  - dist/_astro CSS and JS raw/gzip sizes.
  - Hero, PlexusScene, and SocialDock chunk sizes.
  - Homepage blocking stylesheets, KaTeX, Google Fonts stylesheet, Cloudflare beacon, and standalone SocialDock island when PERF_URL is set.

Note:
  Run npm run build first so dist/_astro exists and reflects the latest production output.`);
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(path);
      return path;
    }),
  );
  return files.flat();
}

async function fileSize(path) {
  const bytes = await readFile(path);
  return {
    path,
    rawBytes: bytes.byteLength,
    gzipBytes: gzipSync(bytes).byteLength,
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function sum(items, key) {
  return items.reduce((total, item) => total + item[key], 0);
}

function getLinks(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
}

function getAttr(tag, name) {
  const match = tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match?.[1];
}

async function analyzeHomeHtml(url) {
  if (!url) return null;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const links = getLinks(html);
  const stylesheetHrefs = links
    .filter((tag) => getAttr(tag, "rel") === "stylesheet")
    .map((tag) => getAttr(tag, "href"))
    .filter(Boolean);
  const preloadHrefs = links
    .filter((tag) => getAttr(tag, "rel") === "preload")
    .map((tag) => getAttr(tag, "href"))
    .filter(Boolean);

  return {
    url,
    htmlBytes: Buffer.byteLength(html),
    scriptCount: (html.match(/<script\b/gi) || []).length,
    stylesheetHrefs,
    preloadHrefs,
    modulepreloadCount: (html.match(/rel=["']modulepreload["']/gi) || []).length,
    hasKatex: html.includes("katex.min.css"),
    hasGoogleFontsStylesheet: html.includes("fonts.googleapis.com"),
    hasCloudflareBeacon: html.includes("cloudflareinsights.com") || html.includes("beacon.min.js"),
    hasHeroIsland: html.includes("component-url=\"/src/components/Hero.tsx\""),
    hasStandaloneSocialDockIsland: html.includes("component-url=\"/src/components/SocialDock.tsx\""),
  };
}

function budgetResult(name, actual, limit) {
  return {
    name,
    actual,
    limit,
    pass: actual <= limit,
  };
}

function formatCheckValue(check) {
  if (check.name.includes("bytes")) {
    return `${formatBytes(check.actual)} / ${formatBytes(check.limit)}`;
  }
  return `${check.actual} / ${check.limit}`;
}

function printSummary(report) {
  const failed = report.checks.filter((check) => !check.pass);

  console.log("Homepage performance budget");
  console.log("");
  console.log(`CSS: ${formatBytes(report.dist.css.rawBytes)} raw, ${formatBytes(report.dist.css.gzipBytes)} gzip`);
  console.log(`JS total: ${formatBytes(report.dist.javascript.rawBytes)} raw, ${formatBytes(report.dist.javascript.gzipBytes)} gzip`);
  console.log(
    `Hero chunks: ${formatBytes(sum(heroFiles, "rawBytes"))} raw, ${formatBytes(sum(heroFiles, "gzipBytes"))} gzip`,
  );
  console.log(
    `Plexus chunk: ${formatBytes(sum(plexusFiles, "rawBytes"))} raw, ${formatBytes(sum(plexusFiles, "gzipBytes"))} gzip`,
  );
  console.log(
    `SocialDock chunks: ${formatBytes(sum(socialDockFiles, "rawBytes"))} raw, ${formatBytes(sum(socialDockFiles, "gzipBytes"))} gzip`,
  );
  console.log("");

  if (report.home) {
    console.log(`Home URL: ${report.home.url}`);
    console.log(`Home HTML: ${formatBytes(report.home.htmlBytes)}`);
    console.log(`Blocking stylesheet links: ${report.home.stylesheetHrefs.length}`);
    console.log(`Preload links: ${report.home.preloadHrefs.length}`);
    console.log(`Scripts: ${report.home.scriptCount}`);
    console.log(`KaTeX on home: ${report.home.hasKatex ? "yes" : "no"}`);
    console.log(
      `Google Fonts stylesheet on home: ${report.home.hasGoogleFontsStylesheet ? "yes" : "no"}`,
    );
    console.log(`Cloudflare beacon in source HTML: ${report.home.hasCloudflareBeacon ? "yes" : "no"}`);
    console.log(`Standalone SocialDock island: ${report.home.hasStandaloneSocialDockIsland ? "yes" : "no"}`);
    console.log("");
  } else {
    console.log("Home HTML: not checked. Set PERF_URL to inspect the served homepage.");
    console.log("Example: PERF_URL=http://127.0.0.1:4321/ pnpm perf:budget");
    console.log("");
  }

  console.log("Checks:");
  for (const check of report.checks) {
    console.log(`- ${check.pass ? "PASS" : "FAIL"} ${check.name}: ${formatCheckValue(check)}`);
  }

  if (failed.length === 0) {
    console.log("");
    console.log("Result: all configured budgets passed.");
  }
}

if (showHelp) {
  printHelp();
  process.exit(0);
}

if (!(await pathExists(astroDir))) {
  throw new Error("Missing dist/_astro. Run `npm run build` before checking the performance budget.");
}

const files = await listFiles(astroDir);
const sizedFiles = await Promise.all(files.map(fileSize));
const cssFiles = sizedFiles.filter((file) => file.path.endsWith(".css"));
const jsFiles = sizedFiles.filter((file) => file.path.endsWith(".js"));
const heroFiles = jsFiles.filter((file) => /\/Hero\.[^.]+\.js$/.test(file.path));
const plexusFiles = jsFiles.filter((file) => /\/PlexusScene\.[^.]+\.js$/.test(file.path));
const socialDockFiles = jsFiles.filter((file) => /\/SocialDock\.[^.]+\.js$/.test(file.path));
const html = await analyzeHomeHtml(homeUrl);

const checks = [
  budgetResult("css raw bytes", sum(cssFiles, "rawBytes"), budgets.cssRawBytes),
  budgetResult("hero chunk raw bytes", sum(heroFiles, "rawBytes"), budgets.heroRawBytes),
];

if (html) {
  checks.push(
    budgetResult(
      "initial blocking stylesheets",
      html.stylesheetHrefs.length,
      budgets.initialBlockingStylesheets,
    ),
    budgetResult(
      "Google Fonts stylesheets",
      html.hasGoogleFontsStylesheet ? 1 : 0,
      budgets.googleFontsStylesheets,
    ),
    budgetResult("KaTeX on homepage", html.hasKatex ? 1 : 0, budgets.katexOnHome),
  );
}

const report = {
  generatedAt: new Date().toISOString(),
  dist: {
    css: {
      count: cssFiles.length,
      rawBytes: sum(cssFiles, "rawBytes"),
      gzipBytes: sum(cssFiles, "gzipBytes"),
      files: cssFiles.map((file) => ({
        path: relative(distDir, file.path),
        raw: formatBytes(file.rawBytes),
        gzip: formatBytes(file.gzipBytes),
      })),
    },
    javascript: {
      count: jsFiles.length,
      rawBytes: sum(jsFiles, "rawBytes"),
      gzipBytes: sum(jsFiles, "gzipBytes"),
      hero: heroFiles.map((file) => ({
        path: relative(distDir, file.path),
        raw: formatBytes(file.rawBytes),
        gzip: formatBytes(file.gzipBytes),
      })),
      plexus: plexusFiles.map((file) => ({
        path: relative(distDir, file.path),
        raw: formatBytes(file.rawBytes),
        gzip: formatBytes(file.gzipBytes),
      })),
      socialDock: socialDockFiles.map((file) => ({
        path: relative(distDir, file.path),
        raw: formatBytes(file.rawBytes),
        gzip: formatBytes(file.gzipBytes),
      })),
    },
  },
  home: html,
  checks,
};

if (outputJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printSummary(report);
}

const failed = checks.filter((check) => !check.pass);
if (failed.length > 0 && shouldFail) {
  console.error(
    `Performance budget failed: ${failed.map((check) => check.name).join(", ")}`,
  );
  process.exit(1);
}
