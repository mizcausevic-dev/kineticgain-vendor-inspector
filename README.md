# Vendor AI Disclosure Inspector

> See what AI governance documents any vendor publishes at `/.well-known/` — the eleven [Kinetic Gain Protocol Suite](https://github.com/mizcausevic-dev/kinetic-gain-protocol-suite) specs, scored 0-100 — without leaving the page.

Two distribution surfaces, one shared probe core:

| Artifact | For | Where it shows |
| --- | --- | --- |
| **Browser extension** (Manifest V3) | Chrome, Edge, Firefox | Toolbar popup — click the icon, see the report for the active tab |
| **Greasemonkey / Tampermonkey userscript** | Power users (Violentmonkey too) | A live corner badge on every page you visit |

Both read the same `/.well-known/` endpoints and produce the same 0-100 disclosure score + per-spec breakdown. The shared logic lives in [`shared/well-known-probe.js`](shared/well-known-probe.js) (vendored from the standalone [`well-known-probe-js`](https://github.com/mizcausevic-dev/well-known-probe-js) package).

## What it checks

The eleven Suite documents, each at its canonical well-known path:

| Spec | Path |
| --- | --- |
| AEO Protocol | `/.well-known/aeo.json` |
| Agent Cards | `/.well-known/agents/index.json` |
| Prompt Provenance | `/.well-known/prompts/index.json` |
| AI Evidence Format | `/.well-known/evidence/index.json` |
| MCP Tool Cards | `/.well-known/tool-cards/index.json` |
| AI Tutor Cards | `/.well-known/tutor-cards/index.json` |
| Student AI Disclosure | `/.well-known/student-ai/index.json` |
| Classroom AI AUP | `/.well-known/aup.json` |
| Clinical AI Disclosure | `/.well-known/clinical-ai/index.json` |
| AI Incident Card | `/.well-known/incidents/index.json` |
| AI Procurement Decision | `/.well-known/decisions/index.json` |

Score = published / 11, mapped to a tier: **comprehensive** (≥90) · **strong** (≥60) · **partial** (≥30) · **minimal** (≥1) · **none** (0). Discriminator-aware — a `200 OK` serving the wrong JSON shape doesn't count.

## Install — browser extension

### Chrome / Edge (unpacked, until Web Store listing lands)

1. `git clone https://github.com/mizcausevic-dev/kineticgain-vendor-inspector`
2. `cd kineticgain-vendor-inspector && npm run build` (syncs the probe core into `extension/`)
3. Chrome → `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `extension/` folder
4. Pin the icon. Click it on any site.

### Firefox (temporary add-on)

1. Steps 1-2 above
2. Firefox → `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `extension/manifest.json`

> **v0.2** adds branded icons (`extension/icons/{16,32,48,128}.png`, wired into the manifest) and store-submission assets under [`store/`](store/) — listing copy, a 1280×800 marketing screenshot, and the manual upload checklist. Packaged upload zips are produced outside the repo.

## Install — userscript

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome/Edge/Firefox/Safari) or [Violentmonkey](https://violentmonkey.github.io/) or Greasemonkey (Firefox).
2. Open [`dist/kineticgain-inspector.user.js`](dist/kineticgain-inspector.user.js) **raw** and your userscript manager will offer to install it. (Once published, the canonical home is greasyfork.org.)
3. Visit any site — a corner badge shows the score. Click it to expand the per-spec list.

## How it works

```
shared/well-known-probe.js   ← single source of truth (probe + scoring)
        │
        ├── (synced verbatim) ──► extension/well-known-probe.js ──► imported by extension/popup.js
        │
        └── (export-stripped + wrapped) ──► dist/kineticgain-inspector.user.js
                                              = userscript header + core + badge.js
```

`scripts/build-userscript.mjs` regenerates both committed artifacts from the shared core. CI runs `npm run check` to fail the build if either drifts out of sync. The extension fetches cross-origin via MV3 `host_permissions` (bypasses CORS); the userscript runs in page context with `@grant none`.

## Develop

```bash
npm run build    # regenerate extension copy + dist userscript from shared core
npm run check    # verify committed artifacts are in sync (CI uses this)
npm run lint     # node --check syntax pass over all source
npm test         # node:test — probe behavior + build integrity
```

If you change probe logic, edit **`shared/well-known-probe.js`** and run `npm run build`. Never edit `extension/well-known-probe.js` or `dist/*.user.js` by hand — they're generated.

## Composes with

| Repo | Relationship |
| --- | --- |
| [`well-known-probe-js`](https://github.com/mizcausevic-dev/well-known-probe-js) | Canonical npm package; this repo vendors a single-file build of it |
| [`kinetic-gain-protocol-suite`](https://github.com/mizcausevic-dev/kinetic-gain-protocol-suite) | The eleven specs this inspector detects |
| [AI Procurement Pulse](https://pulse.kineticgain.com/) | Same probe, run server-side at scale; the inspector is the per-user client view |
| [`well-known-walker-web`](https://github.com/mizcausevic-dev/well-known-walker-web) | The hosted web version (paste a domain); this is the always-on browser companion |

## License

MIT.
