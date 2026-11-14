#!/usr/bin/env node
// Verification CLI: the lever agents use to check their own work.
// Every command supports --json. Exit 0 on success, 1 on failure.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const json = argv.includes("--json");
const args = argv.filter((a) => a !== "--json");

// Filled by create-verification-skill, e.g. { start: ["npm", "run", "dev"], url: "http://localhost:5173", expect: "<title>My App</title>" }
// `expect`: exact, case-sensitive text only this app's HTML contains (its <title>), so another app on the port is never captured.
// Generic dev-server text like "/@vite/client" is not enough: any other Vite project on the same port has it too.
const APP = { start: ["npm", "run", "dev"], url: "http://localhost:3000", expect: "<title>Versus Electoral Perú — Candidatos a Alcalde de Lima 2026</title>" };

const HELP = `Usage: node scripts/control.mjs <command> [--json]

Commands:
  doctor    Check the environment is ready (node, deps, git hooks, branch)
  verify    Run the project's typecheck, lint and test npm scripts that exist; report each step

  screenshot [route] [--out <file.png>] [--wait <ms>] [--full-page] [--port <n>]
            Headless screenshot of a route of the app, "/" by default (needs APP set and Playwright installed in the project)
            Without --out it writes $TMPDIR/<project>-screenshot.png, overwritten on every run
            --port replaces the port of APP.url (default is APP.url's); use it for a worktree's own dev server, which you start first
            Example: node scripts/control.mjs screenshot /settings --full-page

  get <path> [--expect <text>] [--port <n>]
            GET a page or API route of the running dev server (npm run dev) and report status, content type and size.
            Covers every route in .claude/verification/features/. With --expect, fails unless the body contains the text.
            Read-only: never call /api/cron or /api/scrape, they write to the database.
            Example: node scripts/control.mjs get /api/propuestas?candidato=keiko-fujimori --expect propuestas

Every command exits 0 on success and 1 on failure. Add --json for machine-readable output.`;

function run(cmd, cmdArgs) {
  const start = Date.now();
  const r = spawnSync(cmd, cmdArgs, { cwd: root, encoding: "utf8" });
  return { ok: r.status === 0, ms: Date.now() - start, output: `${r.stdout ?? ""}${r.stderr ?? ""}`.trim() };
}

function report(ok, data, text) {
  process.stdout.write(json ? `${JSON.stringify({ ok, ...data }, null, 2)}\n` : `${text}\n`);
  process.exit(ok ? 0 : 1);
}

// The Node major the project pins (.nvmrc, .node-version or package.json engines.node), or null.
// Returns { file, min, exact }: `exact` for a fixed major ("24", "v24.1", "^24", "24.x"), `min` for ">=24".
function nodePin() {
  for (const file of [".nvmrc", ".node-version"]) {
    const major = existsSync(join(root, file)) && readFileSync(join(root, file), "utf8").trim().match(/^v?(\d+)/)?.[1];
    if (major) return { file, exact: Number(major) };
  }
  let range = "";
  try {
    range = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).engines?.node ?? "";
  } catch {}
  const min = range.match(/^>=\s*v?(\d+)/)?.[1];
  if (min) return { file: "package.json engines.node", min: Number(min) };
  const exact = range.match(/^[\^~]?v?(\d+)(\.[\dx*]+)*$/)?.[1];
  return exact ? { file: "package.json engines.node", exact: Number(exact) } : null;
}

// First .githooks stub that is missing, not executable or does not run its guard, else null.
function hookProblem() {
  const guards = { "pre-commit": "branch-guard.mjs", "pre-merge-commit": "branch-guard.mjs", "pre-push": "branch-guard.mjs", "commit-msg": "attribution-guard.mjs" };
  for (const [name, guard] of Object.entries(guards)) {
    const file = join(root, ".githooks", name);
    if (!existsSync(file)) return `.githooks/${name} is missing. Copy it from the dev-factory plugin templates/githooks`;
    if (!(statSync(file).mode & 0o111)) return `.githooks/${name} is not executable. Run: chmod +x .githooks/${name}`;
    if (!readFileSync(file, "utf8").includes(guard)) return `.githooks/${name} does not run ${guard}. Restore it from the dev-factory plugin templates/githooks`;
  }
  return null;
}

async function doctor() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  const pin = nodePin();
  const hooksPath = run("git", ["config", "--get", "core.hooksPath"]);
  const branch = run("git", ["symbolic-ref", "--short", "-q", "HEAD"]);
  const isRepo = run("git", ["rev-parse", "--is-inside-work-tree"]).ok;

  let branchProblem = null;
  try {
    const { commitViolation } = await import("./guard/branch-guard.mjs");
    branchProblem = commitViolation(branch.ok ? branch.output : null);
  } catch {
    branchProblem = "scripts/guard/branch-guard.mjs is missing. Copy it from the dev-factory plugin (see the create-verification-skill skill)";
  }

  const checks = [
    { name: "node", ok: major > 22 || (major === 22 && minor >= 18), fix: "Install Node 22.18+" },
    ...(pin
      ? [{
          name: `node matches project pin (${pin.file})`,
          ok: pin.exact ? major === pin.exact : major >= pin.min,
          fix: `the project pins Node ${pin.exact ?? `>=${pin.min}`} but this shell runs ${process.versions.node}. Switch with: nvm use (or fnm use)`,
        }]
      : []),
    ...(existsSync(join(root, "package.json"))
      ? [{ name: "dependencies", ok: existsSync(join(root, "node_modules")), fix: "npm install" }]
      : []),
    { name: "git repository", ok: isRepo, fix: "git init" },
    { name: "git hooks", ok: hooksPath.output === ".githooks" && !hookProblem(), fix: hooksPath.output === ".githooks" ? hookProblem() : "git config core.hooksPath .githooks" },
    { name: "work branch (feat/, fix/, hotfix/)", ok: isRepo && !branchProblem, fix: branchProblem ?? "git init" },
  ];
  const ok = checks.every((c) => c.ok);
  const text = checks.map((c) => `${c.ok ? "ok  " : "FAIL"} ${c.name}${c.ok ? "" : `  ->  ${c.fix}`}`).join("\n");
  report(ok, { checks }, text);
}

function verify() {
  let scripts = {};
  try {
    scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts ?? {};
  } catch {}
  const found = ["typecheck", "lint", "test"].filter((name) => scripts[name]);
  // Fall back to a project-defined "verify" script when the standard ones are absent.
  const names = found.length ? found : scripts.verify ? ["verify"] : [];
  if (names.length === 0) {
    report(false, { error: "no typecheck, lint, test or verify script" }, "FAIL no typecheck, lint, test or verify script in package.json  ->  add at least one, then re-run verify");
  }
  const steps = names.map((step) => ({ step, ...run("npm", ["run", step, "--silent"]) }));
  const ok = steps.every((s) => s.ok);
  const text = steps
    .map((s) => `${s.ok ? "ok  " : "FAIL"} ${s.step} (${s.ms}ms)${s.ok ? "" : `\n${s.output.split("\n").slice(-20).join("\n")}`}`)
    .join("\n");
  report(ok, { steps: steps.map(({ output, ...s }) => (s.ok ? s : { ...s, output })) }, text);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const answers = (url) => fetch(url, { signal: AbortSignal.timeout(2000) }).then(() => true, () => false);

// { status, text } of a page, or null if it fails to load. Long timeout: SSR streams the body after the headers.
const page = (url) => fetch(url, { signal: AbortSignal.timeout(15000) }).then(async (r) => ({ status: r.status, text: await r.text() }), () => null);
const isApp = (p) => Boolean(p?.text.includes(APP.expect));
const got = (p) => (p ? `HTTP ${p.status}` : "no page within 15s");

const PW_HINT = "npm i -D playwright && npx playwright install chromium";
const SIGNALS = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };

// Directories of the processes listening on `port` (via lsof), or null when it cannot tell.
function servedFrom(port) {
  const ls = (a) => spawnSync("lsof", a, { encoding: "utf8", timeout: 5000 });
  const pids = (ls(["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"]).stdout ?? "").split("\n").filter(Boolean);
  const dirs = pids.flatMap((pid) => (ls(["-a", "-p", pid, "-d", "cwd", "-Fn"]).stdout ?? "").split("\n").filter((l) => l.startsWith("n")).map((l) => l.slice(1)));
  return dirs.length ? dirs : null;
}

async function screenshot(lineArgs) {
  const flag = (name) => (lineArgs.includes(name) ? lineArgs[lineArgs.indexOf(name) + 1] : undefined);
  const route = lineArgs.find((a, i) => !a.startsWith("--") && !["--out", "--wait", "--port"].includes(lineArgs[i - 1])) ?? "/";
  if (!APP.url) {
    report(false, { error: "APP not set" }, "FAIL APP is not set  ->  set APP = { start, url, expect } in scripts/control.mjs (see the create-verification-skill skill)");
  }
  if (!APP.expect) {
    report(false, { error: "APP.expect not set" }, "FAIL APP.expect is not set  ->  set it to text the app's HTML always contains (e.g. \"/@vite/client\" or its <title>) in scripts/control.mjs");
  }
  const invalid = (error) => report(false, { error }, `FAIL ${error}`);
  const wait = flag("--wait");
  // Capped below the 120 s Playwright timeout; huge values also overflow Node timers.
  const outArg = flag("--out");
  if (lineArgs.includes("--out") && (!outArg || outArg.startsWith("--"))) invalid(`--out needs a file path, got "${outArg ?? ""}"`);
  if (lineArgs.includes("--wait") && !/^\d{1,5}$/.test(wait ?? "")) invalid(`--wait needs a number of milliseconds up to 99999, got "${wait ?? ""}"`);
  const portArg = flag("--port");
  if (lineArgs.includes("--port") && (!/^\d{1,5}$/.test(portArg ?? "") || Number(portArg) < 1 || Number(portArg) > 65535)) invalid(`--port needs a port number from 1 to 65535, got "${portArg ?? ""}"`);
  const url = portArg ? Object.assign(new URL(APP.url), { port: portArg }).href : APP.url;
  // The origin check also catches "//host" and "/\host", which URL parsing sends to another host.
  if (!route.startsWith("/") || new URL(route, url).origin !== new URL(url).origin) invalid(`route must be a path starting with a single "/", got "${route}"`);
  const timeoutEnv = process.env.CONTROL_START_TIMEOUT_MS;
  if (timeoutEnv !== undefined && !/^[1-9]\d*$/.test(timeoutEnv)) invalid(`CONTROL_START_TIMEOUT_MS must be a positive number of milliseconds, got "${timeoutEnv}"`);
  // The project's own binary: npx would silently fall back to a global Playwright.
  const pwBin = join(root, "node_modules", ".bin", "playwright");
  if (!existsSync(pwBin)) {
    report(false, { error: "Playwright is not installed in this project", fix: PW_HINT }, `FAIL Playwright is not installed in this project  ->  ${PW_HINT}`);
  }
  const target = new URL(route, url).href;
  // Resolved from the caller's cwd (Playwright runs from the project root); absolute, so "-x.png" is never read as a flag.
  // One fixed file per project, so repeated runs never pile up temp directories.
  const out = outArg ? resolve(outArg) : join(tmpdir(), `${basename(root)}-screenshot.png`);
  let server = null;
  let pwChild = null;
  let exited = false;
  let warning = null;
  let log = "";
  const tail = () => log.trim().split("\n").slice(-10).join("\n");
  // Only ever kills a server this run started.
  const stop = () => {
    if (pwChild?.pid && pwChild.exitCode === null) try { process.kill(-pwChild.pid, "SIGKILL"); } catch {}
    if (server?.pid && !exited) try { process.kill(-server.pid, "SIGKILL"); } catch {}
  };
  const fail = (error, text) => {
    stop();
    report(false, { error, detail: text }, `FAIL ${text}`);
  };
  for (const [sig, code] of Object.entries(SIGNALS)) process.on(sig, () => { stop(); process.exit(code); });
  const { port, protocol } = new URL(url);
  const home = (await answers(url)) ? await page(url) : null;
  if (home && !isApp(home)) {
    fail("port taken", `${url} answers (${got(home)}) but its page does not contain APP.expect ("${APP.expect}"): another app holds the port, or the app is failing  ->  check what listens (lsof -nP -iTCP:${port || (protocol === "https:" ? 443 : 80)} -sTCP:LISTEN), stop it if it is not this app, then retry`);
  }
  if (home) {
    // A second checkout of the same app passes isApp, so check the server runs from this project.
    const dirs = servedFrom(new URL(url).port || (protocol === "https:" ? 443 : 80));
    const rootReal = realpathSync(root);
    const inside = (d) => { const r = relative(rootReal, d); return !r.startsWith("..") && !isAbsolute(r); };
    if (dirs && !dirs.some(inside)) fail("other checkout", `${url} is served from ${dirs.join(", ")}, not from this project (${rootReal}): another checkout holds the port  ->  stop it, or run this checkout's server on another port and pass --port <n>`);
    if (!dirs) warning = `could not confirm that ${url} is served from this checkout (lsof missing or no listener found)`;
  }
  if (!home) {
    if (portArg) fail("app not running", `${url} does not answer and --port was given  ->  start this checkout's dev server on port ${portArg} first, then retry`);
    if (!APP.start) fail("app not running", `${url} does not answer and APP.start is not set  ->  start the app or set APP.start in scripts/control.mjs`);
    server = spawn(APP.start[0], APP.start.slice(1), { cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    server.on("error", (e) => { log += `${e.message}\n`; exited = true; });
    server.on("exit", () => (exited = true));
    for (const stream of [server.stdout, server.stderr]) stream.on("data", (d) => (log += d));
    const deadline = Date.now() + Number(timeoutEnv ?? 60000);
    let up = false;
    while (!up && !exited && Date.now() < deadline) {
      await sleep(500);
      up = await answers(url);
    }
    if (!up && exited) fail("app did not start", `"${APP.start.join(" ")}" exited before ${url} answered  ->  last output:\n${tail()}`);
    if (!up) fail("app did not start", `${url} did not answer after starting "${APP.start.join(" ")}"  ->  last output:\n${tail()}`);
    const started = await page(url);
    if (!isApp(started)) fail("not the app", `"${APP.start.join(" ")}" started but ${url} (${got(started)}) does not contain APP.expect ("${APP.expect}")  ->  fix APP.expect or url in scripts/control.mjs`);
  }
  const pw = await new Promise((resolve) => {
    // Own process group so an interrupt can kill Playwright and its browser together.
    const child = (pwChild = spawn(pwBin, ["screenshot", ...(lineArgs.includes("--full-page") ? ["--full-page"] : []), ...(wait ? ["--wait-for-timeout", wait] : []), target, out], { cwd: root, detached: true }));
    let output = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 120000);
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (d) => (output += d));
    child.on("error", (e) => { output += e.message; });
    child.on("close", (status) => { clearTimeout(timer); resolve({ ok: status === 0, output: timedOut ? `${output}\nPlaywright timed out after 120s` : output }); });
  });
  stop();
  if (!pw.ok) {
    const msg = pw.output.trim();
    const missing = /Executable doesn't exist|playwright install/i.test(msg);
    report(false, { error: msg, ...(missing ? { fix: PW_HINT } : {}) }, `FAIL screenshot of ${target}  ->  ${missing ? `Playwright browser is missing: ${PW_HINT}` : msg.split("\n").slice(-10).join("\n")}`);
  }
  report(true, { url: target, file: out, ...(warning ? { warning } : {}) }, `ok screenshot ${target} -> ${out}${warning ? `\nwarning: ${warning}` : ""}`);
}

async function get(lineArgs) {
  const flag = (name) => (lineArgs.includes(name) ? lineArgs[lineArgs.indexOf(name) + 1] : undefined);
  const path = lineArgs.find((a, i) => !a.startsWith("--") && !["--expect", "--port"].includes(lineArgs[i - 1]));
  if (!path) report(false, { error: "no path" }, "FAIL pass a path  ->  node scripts/control.mjs get /api/propuestas?candidato=<slug>");
  const portArg = flag("--port");
  const base = portArg ? Object.assign(new URL(APP.url), { port: portArg }).href : APP.url;
  const url = new URL(path, base);
  if (url.origin !== new URL(base).origin) report(false, { error: "bad path" }, `FAIL path must start with a single "/", got "${path}"`);
  if (/^\/api\/(cron|scrape)/.test(url.pathname)) report(false, { error: "writes" }, `FAIL ${url.pathname} scrapes and writes to the database  ->  do not call it from verification`);
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) }).catch(() => null);
  if (!res) report(false, { error: "no answer" }, `FAIL ${url.href} does not answer  ->  start the dev server first: npm run dev`);
  const text = await res.text();
  const expect = flag("--expect");
  const missing = expect !== undefined && !text.includes(expect);
  const data = { url: url.href, status: res.status, contentType: res.headers.get("content-type"), bytes: Buffer.byteLength(text), ...(expect !== undefined ? { expectFound: !missing } : {}) };
  const line = `${res.ok && !missing ? "ok  " : "FAIL"} GET ${url.pathname}${url.search} -> HTTP ${res.status} ${data.contentType} ${data.bytes}B${missing ? `  (missing "${expect}")` : ""}`;
  report(res.ok && !missing, data, line);
}

// eslint-disable-next-line no-unused-vars -- `rest` is used by feature commands added below.
const [command, ...rest] = args;
if (command === "doctor") await doctor();
else if (command === "verify") verify();
else if (command === "screenshot") await screenshot(rest);
else if (command === "get") await get(rest);
else {
  process.stdout.write(`${HELP}\n`);
  process.exit(command && command !== "--help" && command !== "help" ? 1 : 0);
}
