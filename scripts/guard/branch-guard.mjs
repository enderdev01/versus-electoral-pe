// Branch policy for every agent and every human:
//   - commits only on work branches: `feat/*`, `fix/*`, `hotfix/*`
//   - never commit or push to a protected branch (or anything under it, e.g. release/1.2)
//
// One policy, three entry points:
//   node branch-guard.mjs claude       Claude Code PreToolUse hook (Bash), reads hook JSON on stdin
//   node branch-guard.mjs pre-commit   git pre-commit / pre-merge-commit hook
//   node branch-guard.mjs pre-push     git pre-push hook, reads "<local ref> <sha> <remote ref> <sha>" lines
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, normalize } from "node:path";
import { inScope, isMain, projectDir } from "./scope.mjs";

export const PROTECTED = ["develop", "desarrollo", "desa", "main", "master", "production", "prod", "test", "release"];
export const WORK_PREFIXES = ["feat/", "fix/", "hotfix/"];

const shortName = (ref) => ref.replace(/^refs\/heads\//, "");

export function isProtected(ref) {
  const first = shortName(ref).toLowerCase().split("/")[0];
  return PROTECTED.includes(first);
}

export function isWorkBranch(ref) {
  return WORK_PREFIXES.some((prefix) => shortName(ref).startsWith(prefix));
}

export function commitViolation(branch) {
  if (!branch) return "HEAD is detached or unknown. Create a branch first: git switch -c feat/<name> (or fix/, hotfix/)";
  if (isProtected(branch)) return `"${branch}" is a protected branch. Work on a feat/, fix/ or hotfix/ branch: git switch -c feat/<name>`;
  if (!isWorkBranch(branch)) return `"${branch}" is not a feat/, fix/ or hotfix/ branch. Rename it: git branch -m feat/<name>`;
  return null;
}

export function pushViolation(remoteRef) {
  if (isProtected(remoteRef)) return `Pushing to protected branch "${shortName(remoteRef)}" is forbidden. Open a PR from a feat/, fix/ or hotfix/ branch instead.`;
  if (!isWorkBranch(remoteRef)) return `Only feat/, fix/ and hotfix/ branches may be pushed, got "${shortName(remoteRef)}".`;
  return null;
}

// git global options that take a separate value: `git -c k=v commit`, `git -C dir commit`.
const GIT_OPTIONS_WITH_VALUE = ["-c", "-C", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"];

// Split `git [global options] <subcommand> [args]` into the subcommand and its arguments.
function parseGit(words) {
  let i = 0;
  while (i < words.length && words[i].startsWith("-")) i += GIT_OPTIONS_WITH_VALUE.includes(words[i]) ? 2 : 1;
  return { sub: words[i], rest: words.slice(i + 1) };
}

// A `gh` call whose only quoted text is inert data (no `$`, backtick, `;`, `|`...) cannot run git, so its
// text (e.g. an issue body that mentions `git commit`) is not inspected. `gh alias`/`extension` can run shell.
const GH_DATA = /"\$\(cat <<'(\w+)'\n([\s\S]*?)\n\1\n\)"|"(?:\\.|[^"\\$`])*"|'[^']*'/g;
export function isPlainGhCall(command) {
  if (!/^gh\s/.test(command) || /^gh\s+(alias|extension)\b/.test(command)) return false;
  // A body line equal to the delimiter would end the heredoc early and run the rest: keep the `$` so it is rejected.
  const rest = command.replace(GH_DATA, (m, tag, body) => (tag && body.split("\n").includes(tag) ? m : ""));
  return !/[;&|<>(){}$`\\#"'\n]/.test(rest);
}

// Directory the command's git runs in, or null (= the session branch). Only strict shapes are trusted:
// `cd <path> && git ...` or `&&`-chained `git -C <same path> ...`; everything else could hide a second cd.
// Inert quoted data / safe heredocs (as in isPlainGhCall) and a trailing `2>&1`, `>/dev/null`, `| tail|head|cat`
// are ignored. Quoted text becomes \u0001 so a quoted `"-C"` before the subcommand is still rejected.
const PATH_RE = /^(\/|\.\/|\.\.\/|~\/|\.\.$|\.$)[\w./@+-]*$/;
const DIR_OPTION = /^(-C|-c|--git-dir|--work-tree)/;
const SAFE_TAIL = /(?:\s+(?:2>&1|[12]?>\/dev\/null))*(?:\s*\|\s*(?:tail|head|cat)(?:\s+(?!git\b)-?\w+)*)?$/;
export function targetDir(command) {
  const stripped = command.replace(GH_DATA, (m, tag, body) => (tag && body.split("\n").includes(tag) ? m : "\u0001"));
  const bare = stripped.replace(SAFE_TAIL, "");
  if (/[$`\\\n;|<>(){}#!"']/.test(bare) || /&/.test(bare.replace(/&&/g, ""))) return null;
  const parts = bare.split("&&").map((p) => p.trim());
  const words = (p) => p.split(/\s+/);
  // true when a dir/config option (or quoted text) sits among the leading git options
  const badOptions = (ws) => {
    for (let i = 0; i < ws.length && ws[i].startsWith("-"); i += GIT_OPTIONS_WITH_VALUE.includes(ws[i]) ? 2 : 1) {
      if (DIR_OPTION.test(ws[i]) || ws[i].includes("\u0001")) return true;
    }
    return ws[0]?.includes("\u0001") ?? false;
  };
  const home = (d) => (d.startsWith("~/") ? homedir() + d.slice(1) : d);
  const gitC = parts.map((p) => /^git\s+-C\s+(\S+)(\s.*)?$/.exec(p));
  if (gitC.every((m) => m && PATH_RE.test(m[1]) && m[1] === gitC[0][1] && !badOptions(words(m[2] ?? "").filter(Boolean)))) {
    return home(gitC[0][1]); // raw: `git -C` follows symlinks physically, so `..` must not be folded here
  }
  const cd = /^cd\s+(\S+)$/.exec(parts[0]);
  if (!cd || !PATH_RE.test(cd[1])) return null;
  const ok = parts.slice(1).every((p) => /^git(\s|$)/.test(p) && !words(p).some((w) => DIR_OPTION.test(w)) && !badOptions(words(p).slice(1)));
  return ok ? normalize(home(cd[1])) : null;
}

// Best-effort check of a shell command before Claude runs it. The git hooks are the authoritative layer.
export function checkCommand(command, currentBranch, branchAt = () => null) {
  if (!/\bgit\b/.test(command)) return null;
  // git accepts any unambiguous prefix of a long option, so `--no-verif` is `--no-verify`.
  if (/(^|[\s"'])--no-v/.test(command)) return "--no-verify is forbidden: the git hooks enforce the branch policy.";
  // An included config file can set core.hooksPath without naming it here.
  if (/\binclude\.path\b|\bincludeif\./i.test(command)) return "Changing git config includes is forbidden: an included file could disable the git hooks.";
  // The one allowed form is the setup step: `git config [--local] core.hooksPath .githooks`.
  const withoutSetup = command.replace(/\bgit\s+config\s+(--local\s+)?core\.hooksPath\s+\.githooks(?![^\s;&|])/gi, "");
  if (/core\.hooksPath/i.test(withoutSetup)) return "Changing core.hooksPath is forbidden: it would disable the branch policy.";

  if (isPlainGhCall(command)) return null;

  // Quotes are dropped so `bash -c 'git commit'` is inspected like `git commit`. Only the first git of
  // each segment is inspected. The target dir is honored only for `cd <path> && git ...` or a single
  // `git -C <path> ...`; anything else is judged by the session branch.
  // Redirections are removed first: `2>&1` and `> file` are not refspecs.
  const branch = () => {
    const dir = targetDir(command);
    return dir === null ? currentBranch : branchAt(dir);
  };
  for (const segment of command.replace(/["']/g, " ").replace(/\d*>>?(&\d+|\s*[^\s;&|()`]+)/g, " ").split(/[;&|\n()`]+/)) {
    const words = segment.trim().split(/\s+/);
    const gitAt = words.findIndex((w) => w === "git" || w.endsWith("/git"));
    if (gitAt === -1) continue;
    // These decide which hooks, config and git binary run. GIT_EDITOR, GIT_PAGER and the like are fine.
    if (words.slice(0, gitAt).some((w) => /^(HOME|PATH|GIT_DIR|GIT_EXEC_PATH|GIT_CONFIG\w*)=/.test(w))) {
      return "Setting HOME, PATH, GIT_DIR, GIT_EXEC_PATH or GIT_CONFIG* for a git command is forbidden: it changes which hooks and config git uses.";
    }
    const { sub, rest } = parseGit(words.slice(gitAt + 1));
    const args = [sub, ...rest.filter((w) => !w.startsWith("-"))];

    if (sub === "commit" && rest.some((w) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(w))) {
      return "git commit -n is --no-verify, which is forbidden: the git hooks enforce the branch policy.";
    }
    if (["commit", "merge", "cherry-pick", "revert", "rebase", "am", "reset"].includes(sub)) {
      const problem = commitViolation(branch());
      if (problem) return `git ${sub} blocked: ${problem}`;
    }
    // Plumbing and forced branch moves change a ref without running any hook.
    if (sub === "update-ref" || sub === "commit-tree") return `git ${sub} is forbidden: it moves refs without running the git hooks.`;
    const deletes = sub === "branch" && rest.some((w) => /^(-[a-zA-Z]*[dD][a-zA-Z]*|--delete)$/.test(w));
    const forces =
      (sub === "branch" && rest.some((w) => /^(-[a-zA-Z]*[fM][a-zA-Z]*|--force)$/.test(w))) ||
      (sub === "checkout" && rest.includes("-B")) ||
      (sub === "switch" && rest.some((w) => w === "-C" || w === "--force-create"));
    // A delete names every branch it removes; a forced move names the branch first, then its start point.
    const operands = args.slice(1);
    const moved = deletes ? operands.find(isProtected) : forces && isProtected(operands[0] ?? "") ? operands[0] : null;
    if (moved) return `git ${sub} blocked: "${moved}" is a protected branch and cannot be moved, reset or deleted here.`;
    if (sub === "push") {
      if (/\s--(all|mirror)\b/.test(segment)) return "git push --all/--mirror is forbidden.";
      const refspecs = args.slice(2); // after "push <remote>"
      const targets = refspecs.length ? refspecs.map((r) => r.replace(/^\+/, "").split(":").pop()) : [branch() ?? ""];
      for (const target of targets) {
        const problem = pushViolation(target === "HEAD" ? (branch() ?? "") : target);
        if (problem) return `git push blocked: ${problem}`;
      }
    }
  }
  return null;
}

function currentBranch(cwd) {
  const r = spawnSync("git", ["symbolic-ref", "--short", "-q", "HEAD"], { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function fail(message) {
  process.stderr.write(`Branch policy: ${message}\n`);
  process.exit(2);
}

function main(mode) {
  const stdin = readFileSync(0, "utf8");

  if (mode === "claude") {
    const input = JSON.parse(stdin || "{}");
    // Outside the scope roots (~/DEV plus SKUIZOPS_ROOTS) the Claude hook does nothing; installed git hooks still apply.
    if (!inScope(projectDir(input))) return;
    const command = input.tool_input?.command ?? "";
    const cwd = input.cwd ?? process.cwd();
    const problem = checkCommand(command, currentBranch(cwd), (d) => currentBranch(isAbsolute(d) ? d : cwd + "/" + d));
    if (problem) fail(problem);
    return;
  }
  if (mode === "pre-commit") {
    const problem = commitViolation(currentBranch(process.cwd()));
    if (problem) fail(problem);
    return;
  }
  if (mode === "pre-push") {
    for (const line of stdin.split("\n").filter(Boolean)) {
      const remoteRef = line.split(" ")[2];
      const problem = remoteRef && pushViolation(remoteRef);
      if (problem) fail(problem);
    }
    return;
  }
  fail(`unknown mode "${mode}". Use: claude | pre-commit | pre-push`);
}

if (isMain(import.meta.url)) main(process.argv[2]);
