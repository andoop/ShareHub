#!/usr/bin/env node
// Render a QR code for --text to the terminal.
//
// Default: half-block characters with forced black/white via ANSI colors, so it
// scans regardless of the terminal's light/dark theme (one char per module wide,
// one char per two modules tall — roughly square). Quiet zone included.
//
// --raw : print the module matrix as 0/1 rows (size on the first line). Used by
//         the cross-check against the Dart `qr` package; no ANSI, no quiet zone.
// --ecl L|M|Q|H (default L), --noboost : control error correction for testing.

import { Ecc, QrCode } from "./qrcodegen.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}
function flag(name) {
  return process.argv.includes(name);
}

const text = arg("--text", "");
if (!text) {
  process.stderr.write("usage: qr-print.mjs --text <payload> [--raw] [--ecl L|M|Q|H] [--noboost]\n");
  process.exit(1);
}

const eclMap = { L: Ecc.LOW, M: Ecc.MEDIUM, Q: Ecc.QUARTILE, H: Ecc.HIGH };
const ecl = eclMap[arg("--ecl", "L")] ?? Ecc.LOW;
const forcedMask = Number(arg("--mask", "-1"));

const data = Array.from(Buffer.from(text, "utf8"));
const bb = [];
for (const b of data) {
  for (let i = 7; i >= 0; i--) bb.push((b >>> i) & 1);
}
const seg = { mode: { modeBits: 0x4 }, numChars: data.length, bitData: bb };
const qr = QrCode.encodeSegments([seg], ecl, 1, 40, forcedMask, !flag("--noboost"));

if (flag("--raw")) {
  const lines = [String(qr.size)];
  for (let y = 0; y < qr.size; y++) {
    let row = "";
    for (let x = 0; x < qr.size; x++) row += qr.getModule(x, y) ? "1" : "0";
    lines.push(row);
  }
  process.stdout.write(lines.join("\n") + "\n");
  process.exit(0);
}

const quiet = 4;
const dim = qr.size + quiet * 2;
const dark = (x, y) => qr.getModule(x - quiet, y - quiet);

const out = [];
for (let y = 0; y < dim; y += 2) {
  let line = "";
  for (let x = 0; x < dim; x++) {
    const top = dark(x, y);
    const bottom = y + 1 < dim ? dark(x, y + 1) : false;
    const fg = top ? 30 : 97; // black / bright-white foreground (upper half)
    const bg = bottom ? 40 : 107; // black / bright-white background (lower half)
    line += `\x1b[${fg};${bg}m\u2580`; // ▀ upper half block
  }
  line += "\x1b[0m";
  out.push(line);
}
process.stdout.write(out.join("\n") + "\n");
