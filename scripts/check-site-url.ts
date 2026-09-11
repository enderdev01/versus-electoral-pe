import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { loadEnvConfig, resetEnv } from "@next/env";
import { CANONICAL_SITE_URL, resolveSiteUrl, SITE_URL } from "../src/lib/site";

const ROOT = process.cwd();
const LEGACY_HOST = "transparencia-electoral.pe";
const PRODUCTION_PATHS = [
  "src",
  "next.config.ts",
  "vercel.json",
  ...readdirSync(ROOT).filter((entry) => entry.startsWith(".env")),
];
const problems: string[] = [];
const NOOP_LOG = { info: () => undefined, error: () => undefined };

function expectSiteUrl(input: string | undefined, label: string) {
  try {
    if (resolveSiteUrl(input) !== CANONICAL_SITE_URL) {
      problems.push(`${label} did not resolve to the canonical site URL.`);
    }
  } catch {
    problems.push(`${label} should resolve to the canonical site URL.`);
  }
}

function expectInvalidSiteUrl(input: string, label: string) {
  try {
    resolveSiteUrl(input);
    problems.push(`${label} must be rejected.`);
  } catch (error) {
    if (!(error instanceof Error) || error.message.includes(input)) {
      problems.push(`${label} must fail without exposing its configured value.`);
    }
  }
}

function loadEnvironment(directory: string) {
  try {
    return loadEnvConfig(directory, false, NOOP_LOG, true);
  } finally {
    resetEnv();
  }
}

function expectQuotedEnvWithInlineComment() {
  const directory = mkdtempSync(join(tmpdir(), "site-url-env-"));
  try {
    writeFileSync(
      join(directory, ".env"),
      `NEXT_PUBLIC_SITE_URL="${CANONICAL_SITE_URL}" # production origin\n`
    );
    const loaded = loadEnvironment(directory);
    const parsed = loaded.loadedEnvFiles.find((file) => file.path === ".env")?.env.NEXT_PUBLIC_SITE_URL;
    expectSiteUrl(parsed, "A quoted NEXT_PUBLIC_SITE_URL with an inline comment");
  } finally {
    resetEnv();
    rmSync(directory, { recursive: true, force: true });
  }
}

function sourceFiles(path: string): string[] {
  const absolutePath = join(ROOT, path);
  if (!existsSync(absolutePath)) return [];

  if (!statSync(absolutePath).isDirectory()) return [absolutePath];

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(absolutePath, entry.name);
    return entry.isDirectory() ? sourceFiles(relative(ROOT, entryPath)) : [entryPath];
  });
}

expectSiteUrl(undefined, "An absent NEXT_PUBLIC_SITE_URL");
expectSiteUrl(CANONICAL_SITE_URL, "The canonical NEXT_PUBLIC_SITE_URL");
expectSiteUrl(`${CANONICAL_SITE_URL}/`, "The canonical NEXT_PUBLIC_SITE_URL with a trailing slash");
expectInvalidSiteUrl("https://transparencia-electoral.pe", "The retired NEXT_PUBLIC_SITE_URL");
expectInvalidSiteUrl("https://preview.versuselectoral.com", "A preview NEXT_PUBLIC_SITE_URL");
expectInvalidSiteUrl("not-a-url", "A malformed NEXT_PUBLIC_SITE_URL");
expectQuotedEnvWithInlineComment();

if (SITE_URL !== CANONICAL_SITE_URL) {
  problems.push("The effective NEXT_PUBLIC_SITE_URL must resolve to the canonical site URL.");
}

try {
  resolveSiteUrl(loadEnvironment(ROOT).combinedEnv.NEXT_PUBLIC_SITE_URL);
} catch {
  problems.push("The effective NEXT_PUBLIC_SITE_URL from the build environment is invalid.");
}

for (const productionPath of PRODUCTION_PATHS) {
  for (const file of sourceFiles(productionPath)) {
    if (!/\.(?:[cm]?[jt]sx?|json|ya?ml)$/.test(file) && !basename(file).startsWith(".env")) continue;
    if (readFileSync(file, "utf8").includes(LEGACY_HOST)) {
      problems.push(`${relative(ROOT, file)} still references the retired ${LEGACY_HOST} host.`);
    }
  }
}

if (problems.length > 0) {
  console.error(`[site-url] ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}

console.log(`[site-url] OK: ${CANONICAL_SITE_URL}`);
