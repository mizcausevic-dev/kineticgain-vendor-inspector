#!/usr/bin/env node
/**
 * Package the Chrome Web Store / Firefox AMO submission ZIP from the
 * `extension/` directory. Output goes to `dist/kineticgain-vendor-inspector-v<version>.zip`.
 *
 * The same ZIP works for both Chrome and Firefox because the manifest already
 * carries `browser_specific_settings.gecko.id` — Firefox accepts MV3.
 *
 * Pure Node, no external dep. Zips deterministically: file order alphabetical,
 * timestamps zeroed, so re-running on the same source produces a byte-identical
 * archive (useful for hash-pinning if needed).
 *
 * Usage:
 *   node scripts/package-extension.mjs            # write dist/<name>-v<version>.zip
 *   node scripts/package-extension.mjs --verify   # also print SHA-256 of the ZIP
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'extension');
const OUT_DIR = join(ROOT, 'dist');
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const NAME = PKG.name;
const VERSION = PKG.version;
const OUT_ZIP = join(OUT_DIR, `${NAME}-v${VERSION}.zip`);

const verify = process.argv.includes('--verify');

// ── Walk extension/ and collect file list ────────────────────────────────
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const files = walk(SRC).sort(); // deterministic order

// ── Build a minimal ZIP (PKZip / store + deflate) ────────────────────────
// Spec: PKWare APPNOTE.TXT. We need local file headers + central directory +
// end-of-central-directory record. Zero timestamps (DOS time 0x0000, DOS date
// 0x0021 = 1980-01-01), zero external attrs, no extra fields.

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const localHeaders = [];
const centralEntries = [];
let offset = 0;
const chunks = [];

for (const abs of files) {
  const rel = relative(SRC, abs).split(sep).join('/');
  const data = readFileSync(abs);
  const compressed = deflateRawSync(data, { level: 9 });
  const useDeflate = compressed.length < data.length;
  const payload = useDeflate ? compressed : data;
  const method = useDeflate ? 8 : 0;
  const crc = crc32(data);
  const nameBuf = Buffer.from(rel, 'utf8');

  // Local file header (30 bytes + name)
  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(0x04034b50, 0); // signature
  lfh.writeUInt16LE(20, 4); // version needed
  lfh.writeUInt16LE(0, 6); // flags
  lfh.writeUInt16LE(method, 8); // compression method
  lfh.writeUInt16LE(0x0000, 10); // last mod time = 00:00:00
  lfh.writeUInt16LE(0x0021, 12); // last mod date = 1980-01-01
  lfh.writeUInt32LE(crc, 14);
  lfh.writeUInt32LE(payload.length, 18); // compressed
  lfh.writeUInt32LE(data.length, 22); // uncompressed
  lfh.writeUInt16LE(nameBuf.length, 26); // filename length
  lfh.writeUInt16LE(0, 28); // extra field length

  chunks.push(lfh, nameBuf, payload);
  const localOffset = offset;
  offset += lfh.length + nameBuf.length + payload.length;

  // Central directory entry (46 bytes + name)
  const cdh = Buffer.alloc(46);
  cdh.writeUInt32LE(0x02014b50, 0); // signature
  cdh.writeUInt16LE(20, 4); // version made by
  cdh.writeUInt16LE(20, 6); // version needed
  cdh.writeUInt16LE(0, 8); // flags
  cdh.writeUInt16LE(method, 10);
  cdh.writeUInt16LE(0x0000, 12);
  cdh.writeUInt16LE(0x0021, 14);
  cdh.writeUInt32LE(crc, 16);
  cdh.writeUInt32LE(payload.length, 20);
  cdh.writeUInt32LE(data.length, 24);
  cdh.writeUInt16LE(nameBuf.length, 28);
  cdh.writeUInt16LE(0, 30); // extra field length
  cdh.writeUInt16LE(0, 32); // comment length
  cdh.writeUInt16LE(0, 34); // disk number
  cdh.writeUInt16LE(0, 36); // internal attrs
  cdh.writeUInt32LE(0, 38); // external attrs
  cdh.writeUInt32LE(localOffset, 42);

  centralEntries.push(cdh, nameBuf);
}

const centralStart = offset;
const central = Buffer.concat(centralEntries);
chunks.push(central);
offset += central.length;

// End-of-central-directory (22 bytes)
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); // signature
eocd.writeUInt16LE(0, 4); // disk number
eocd.writeUInt16LE(0, 6); // start disk
eocd.writeUInt16LE(files.length, 8); // entries on this disk
eocd.writeUInt16LE(files.length, 10); // total entries
eocd.writeUInt32LE(central.length, 12); // central dir size
eocd.writeUInt32LE(centralStart, 16); // central dir offset
eocd.writeUInt16LE(0, 20); // comment length
chunks.push(eocd);

const archive = Buffer.concat(chunks);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_ZIP, archive);

const kb = (archive.length / 1024).toFixed(1);
console.log(`[package-extension] wrote ${OUT_ZIP} (${kb} KB, ${files.length} files)`);

if (verify) {
  const sha = createHash('sha256').update(archive).digest('hex');
  console.log(`[package-extension] sha256: ${sha}`);
}
