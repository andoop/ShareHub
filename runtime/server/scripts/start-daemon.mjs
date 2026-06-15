#!/usr/bin/env node
// Start the mobile-review server as a *detached* daemon so it survives the
// agent turn / shell that launched it. A plain `cmd &` stays in the launcher's
// process group and gets reaped when the agent finishes its command or the
// terminal closes — which is why the server "worked right after pairing, then
// died". `detached: true` puts the server in its own session/process group
// (POSIX setsid), immune to that teardown and to controlling-terminal SIGHUP.
//
// Usage: node start-daemon.mjs --repo <path> --host <h> --port <p> --public-url <url>
// Prints the daemon PID and writes it to <repo>/.sandtable-runtime/session/server.pid.

import { spawn } from "node:child_process";
import { mkdirSync, openSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, "..");
const tsxBin = path.join(serverDir, "node_modules", ".bin", "tsx");
const entry = path.join(serverDir, "src", "index.ts");

const passthrough = process.argv.slice(2);

function readArg(name, fallback) {
  const index = passthrough.indexOf(name);
  return index >= 0 && passthrough[index + 1] ? passthrough[index + 1] : fallback;
}

const repo = path.resolve(readArg("--repo", process.cwd()));
const sessionDir = path.join(repo, ".sandtable-runtime", "session");
mkdirSync(sessionDir, { recursive: true });
const pidFile = path.join(sessionDir, "server.pid");
const logFile = path.join(sessionDir, "server.log");

const log = openSync(logFile, "a");
const child = spawn(tsxBin, [entry, ...passthrough], {
  cwd: serverDir,
  detached: true,
  stdio: ["ignore", log, log]
});
// Let this launcher exit without keeping the child tethered to it.
child.unref();

writeFileSync(pidFile, `${child.pid}\n`, "utf8");
process.stdout.write(`${child.pid}\n`);
process.exit(0);
