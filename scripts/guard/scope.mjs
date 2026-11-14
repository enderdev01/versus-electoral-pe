// Where the plugin's Claude Code hooks are active. The plugin is installed for the whole user,
// but its hooks only act on projects under ~/DEV plus any roots added with DEV_FACTORY_ROOTS,
// a ":"-separated list of absolute paths. The variable adds roots, it never replaces ~/DEV.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { basename, delimiter, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve symlinks through the deepest existing ancestor, so a link cannot hide its target.
export function real(path) {
  let head = path;
  const tail = [];
  while (!existsSync(head) && dirname(head) !== head) {
    tail.unshift(basename(head));
    head = dirname(head);
  }
  try {
    return join(realpathSync(head), ...tail);
  } catch {
    return path;
  }
}

// macOS volumes are case-insensitive by default: compare folded.
export const fold = (path) => real(resolve(path)).toLowerCase();
export const under = (path, root) => path === root || path.startsWith(`${root}${sep}`);

export function scopeRoots(env = process.env) {
  const added = env.DEV_FACTORY_ROOTS?.split(delimiter).filter(Boolean) ?? [];
  return [...new Set([join(env.HOME ?? "", "DEV"), ...added].map((root) => resolve(root)))];
}

export function inScope(dir, env = process.env) {
  if (!dir) return false;
  const target = fold(dir);
  return scopeRoots(env).some((root) => under(target, fold(root)));
}

// Projects the human trusts to run their own code from hooks (the verify gate and the linter).
// The list lives outside every repo, so a cloned project cannot trust itself. One absolute path per line.
export function trustFile(env = process.env) {
  return join(env.HOME ?? "", ".config", "dev-factory", "trusted-projects");
}

// Exact match only, compared through symlinks: a trusted folder does not trust the projects inside it.
export function isTrusted(dir, env = process.env) {
  if (!dir || dir.includes("\n")) return false;
  let roots;
  try {
    roots = readFileSync(trustFile(env), "utf8").split("\n").map((l) => l.trim()).filter((l) => l.startsWith("/"));
  } catch {
    return false;
  }
  const target = real(resolve(dir));
  return roots.some((root) => real(resolve(root)) === target);
}

// Single-quoted so a hostile directory name cannot run code when the human pastes the command.
const sh = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
export const trustHint = (dir, env = process.env) =>
  dir.includes("\n")
    ? "this directory name contains a newline and cannot be trusted: rename it."
    : `mkdir -p ${sh(dirname(trustFile(env)))} && echo ${sh(resolve(dir))} >> ${sh(trustFile(env))}`;

// The project directory a hook is running for.
export function projectDir(input = {}) {
  return process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd();
}

// True when the module at `metaUrl` is the script node was started with.
// Both paths are resolved through symlinks: comparing raw paths made scripts silently skip
// their entry point (and the branch guard fail open) when launched via a symlinked path.
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}
