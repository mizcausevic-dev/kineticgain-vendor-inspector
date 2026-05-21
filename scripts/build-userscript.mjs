#!/usr/bin/env node
/**
 * build-userscript.mjs
 *
 * Single source of truth is shared/well-known-probe.js. This script:
 *
 *   1. Syncs shared/well-known-probe.js -> extension/well-known-probe.js
 *      (verbatim, so the MV3 popup can `import` it).
 *   2. Generates dist/kineticgain-inspector.user.js by concatenating:
 *        userscript/header.txt  (the ==UserScript== metadata block)
 *        + shared/well-known-probe.js  (with `export ` keywords stripped)
 *        + userscript/badge.js  (the on-page badge logic)
 *
 * Run with `--check` to verify the committed artifacts are in sync without
 * writing (used in CI). Exits non-zero if anything is stale.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SHARED = join(ROOT, "shared", "well-known-probe.js");
const EXT_COPY = join(ROOT, "extension", "well-known-probe.js");
const HEADER = join(ROOT, "userscript", "header.txt");
const BADGE = join(ROOT, "userscript", "badge.js");
const OUT = join(ROOT, "dist", "kineticgain-inspector.user.js");

const checkMode = process.argv.includes("--check");

const SYNC_BANNER =
  "/* AUTO-SYNCED from shared/well-known-probe.js by scripts/build-userscript.mjs. Do not edit here. */\n";

function buildExtensionCopy(sharedSrc) {
  return SYNC_BANNER + sharedSrc;
}

function buildUserscript(sharedSrc, headerSrc, badgeSrc) {
  // Strip `export ` so the consts become plain top-level declarations inside
  // the userscript's single scope. Covers `export const` and `export function`.
  const flattened = sharedSrc.replace(/^export\s+/gm, "");
  return (
    headerSrc.trimEnd() +
    "\n\n" +
    "/* === probe core (flattened from shared/well-known-probe.js) === */\n" +
    flattened.trimEnd() +
    "\n\n" +
    badgeSrc.trimStart()
  );
}

const sharedSrc = readFileSync(SHARED, "utf8");
const headerSrc = readFileSync(HEADER, "utf8");
const badgeSrc = readFileSync(BADGE, "utf8");

const extCopy = buildExtensionCopy(sharedSrc);
const userscript = buildUserscript(sharedSrc, headerSrc, badgeSrc);

if (checkMode) {
  let stale = false;
  for (const [path, expected] of [
    [EXT_COPY, extCopy],
    [OUT, userscript],
  ]) {
    let actual = "";
    try {
      actual = readFileSync(path, "utf8");
    } catch {
      actual = "";
    }
    if (actual !== expected) {
      console.error(`STALE: ${path} — run \`npm run build\` and commit.`);
      stale = true;
    }
  }
  if (stale) process.exit(1);
  console.log("OK: extension copy + userscript are in sync with shared core.");
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(EXT_COPY, extCopy);
  writeFileSync(OUT, userscript);
  console.log(`Wrote ${EXT_COPY}`);
  console.log(`Wrote ${OUT}`);
}
