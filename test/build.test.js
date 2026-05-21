import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("build produces an in-sync userscript + extension copy", () => {
  // Regenerate, then assert --check passes (i.e. committed artifacts match).
  execSync("node scripts/build-userscript.mjs", { cwd: ROOT });
  // Should not throw:
  execSync("node scripts/build-userscript.mjs --check", { cwd: ROOT });
});

test("generated userscript has the metadata block + flattened core + badge", () => {
  const out = readFileSync(join(ROOT, "dist", "kineticgain-inspector.user.js"), "utf8");
  assert.match(out, /==UserScript==/);
  assert.match(out, /==\/UserScript==/);
  // export keywords must be stripped
  assert.doesNotMatch(out, /^export\s+/m);
  // core symbols present as plain declarations
  assert.match(out, /async function probeWellKnown/);
  assert.match(out, /const SUITE_PATHS/);
  // badge IIFE present
  assert.match(out, /position:fixed/);
});

test("generated userscript is syntactically valid JS", () => {
  // node --check throws on a syntax error.
  execSync("node --check dist/kineticgain-inspector.user.js", { cwd: ROOT });
});

test("extension copy is syntactically valid and carries the sync banner", () => {
  const copy = readFileSync(join(ROOT, "extension", "well-known-probe.js"), "utf8");
  assert.match(copy, /AUTO-SYNCED/);
  execSync("node --check extension/well-known-probe.js", { cwd: ROOT });
});
